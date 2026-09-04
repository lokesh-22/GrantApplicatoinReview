import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role, ReviewStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// POST /api/reviews -> Save DRAFT or submit COMPLETED review
export async function POST(request: Request) {
  try {
    const session = await requireRole([Role.REVIEWER]);
    const body = await request.json();

    const { applicationId, assignmentId, impactScore, feasibilityScore, budgetScore, comments, status } = body;

    if (!applicationId || !assignmentId) {
      return NextResponse.json({ error: 'Missing applicationId or assignmentId' }, { status: 400 });
    }

    // Verify active assignment exists
    const assignment = await prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        applicationId,
        reviewerId: session.user.id,
        removedAt: null,
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Active assignment not found' }, { status: 404 });
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: {
        applicationId_reviewerId: {
          applicationId,
          reviewerId: session.user.id,
        },
      },
    });

    // SERVER-SIDE LOCK: Once COMPLETED, reject any further edit
    if (existingReview && existingReview.status === ReviewStatus.COMPLETED) {
      return NextResponse.json(
        { error: 'Forbidden: Completed reviews cannot be modified.' },
        { status: 403 }
      );
    }

    const reviewStatus = status === 'COMPLETED' ? ReviewStatus.COMPLETED : ReviewStatus.DRAFT;

    // Validation for COMPLETED status: require all 3 scores (1-5) and comments
    if (reviewStatus === ReviewStatus.COMPLETED) {
      if (
        !impactScore || impactScore < 1 || impactScore > 5 ||
        !feasibilityScore || feasibilityScore < 1 || feasibilityScore > 5 ||
        !budgetScore || budgetScore < 1 || budgetScore > 5 ||
        !comments || !comments.trim()
      ) {
        return NextResponse.json(
          { error: 'Completed reviews require valid scores (1-5) for Impact, Feasibility, and Budget, plus comments.' },
          { status: 400 }
        );
      }
    }

    const reviewData = {
      impactScore: impactScore ? Number(impactScore) : null,
      feasibilityScore: feasibilityScore ? Number(feasibilityScore) : null,
      budgetScore: budgetScore ? Number(budgetScore) : null,
      comments: comments ? comments.trim() : null,
      status: reviewStatus,
      completedAt: reviewStatus === ReviewStatus.COMPLETED ? new Date() : null,
    };

    let review;
    try {
      if (existingReview) {
        review = await prisma.review.update({
          where: { id: existingReview.id },
          data: reviewData,
        });
      } else {
        review = await prisma.review.create({
          data: {
            applicationId,
            reviewerId: session.user.id,
            assignmentId,
            ...reviewData,
          },
        });
      }
    } catch (dbError) {
      // Friendly handle DB unique constraint on (applicationId, reviewerId)
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        return NextResponse.json(
          { error: 'You have already submitted or initialized a review for this application.' },
          { status: 409 }
        );
      }
      throw dbError;
    }

    return NextResponse.json({ success: true, review });
  } catch (error) {
    return handleAuthError(error);
  }
}
