import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assignReviewerToApplication, AssignmentError } from '@/lib/assignmentService';

export interface BulkAssignmentReportItem {
  applicationId: string;
  orgName: string;
  reviewerId: string;
  reviewerName: string;
  result: 'succeeded' | 'refused';
  reason?: 'conflict of interest' | 'reviewer at assignment limit' | string;
}

// POST /api/applications/bulk-assign -> Bulk assign reviewers across a funding round
export async function POST(request: Request) {
  try {
    const session = await requireRole([Role.PROGRAM_OFFICER]);
    const { fundingRound, reviewerIds, dueDate } = await request.json();

    if (!fundingRound || !Array.isArray(reviewerIds) || reviewerIds.length === 0 || !dueDate) {
      return NextResponse.json(
        { error: 'fundingRound, reviewerIds (non-empty array), and dueDate are required.' },
        { status: 400 }
      );
    }

    // Fetch all active applications in the specified funding round
    const applications = await prisma.application.findMany({
      where: { fundingRound, archived: false },
      select: { id: true, orgName: true },
    });

    if (applications.length === 0) {
      return NextResponse.json(
        { error: 'No active applications found in the specified funding round.' },
        { status: 404 }
      );
    }

    const reviewers = await prisma.user.findMany({
      where: { id: { in: reviewerIds }, role: Role.REVIEWER },
      select: { id: true, name: true },
    });

    const parsedDueDate = new Date(dueDate);
    const report: BulkAssignmentReportItem[] = [];

    // Attempt assignment for every (application, reviewer) pair independently
    for (const app of applications) {
      for (const rev of reviewers) {
        try {
          // Exactly reuse Step 6's single assignment function with independent transaction
          await assignReviewerToApplication(app.id, rev.id, parsedDueDate, session.user.id);
          report.push({
            applicationId: app.id,
            orgName: app.orgName,
            reviewerId: rev.id,
            reviewerName: rev.name,
            result: 'succeeded',
          });
        } catch (err) {
          let reasonMessage = 'Unknown error';
          if (err instanceof AssignmentError) {
            if (err.message.includes('Conflict of Interest')) {
              reasonMessage = 'conflict of interest';
            } else if (err.message.includes('maximum cap of 5')) {
              reasonMessage = 'reviewer at assignment limit';
            } else {
              reasonMessage = err.message;
            }
          }

          report.push({
            applicationId: app.id,
            orgName: app.orgName,
            reviewerId: rev.id,
            reviewerName: rev.name,
            result: 'refused',
            reason: reasonMessage as any,
          });
        }
      }
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    return handleAuthError(error);
  }
}
