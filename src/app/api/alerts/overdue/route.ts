import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role, ReviewStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// GET /api/alerts/overdue -> Fetch active overdue alerts for Program Officers
export async function GET() {
  try {
    const session = await requireRole([Role.PROGRAM_OFFICER]);
    const now = new Date();

    // 1. Fetch all active overdue assignments (removedAt IS NULL, review NOT COMPLETED, dueDate < NOW)
    const overdueAssignments = await prisma.assignment.findMany({
      where: {
        removedAt: null,
        dueDate: { lt: now },
        reviews: {
          none: { status: ReviewStatus.COMPLETED },
        },
      },
      include: {
        application: { select: { id: true, orgName: true, fundingRound: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        alertDismissals: {
          where: { dismissedByUserId: session.user.id },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // 2. Filter out assignments where an AlertDismissal exists matching the CURRENT dueDate
    const unsuppressedAlerts = overdueAssignments.filter((asgn) => {
      const activeDueDateIso = asgn.dueDate.toISOString();
      const matchingDismissal = asgn.alertDismissals.find(
        (dismissal) => dismissal.dueDateAtDismissal.toISOString() === activeDueDateIso
      );
      return !matchingDismissal;
    });

    return NextResponse.json({
      alerts: unsuppressedAlerts,
      count: unsuppressedAlerts.length,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/alerts/overdue/dismiss -> Dismiss an overdue alert for the current due date
export async function POST(request: Request) {
  try {
    const session = await requireRole([Role.PROGRAM_OFFICER]);
    const { assignmentId } = await request.json();

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Write AlertDismissal snapshotting dueDateAtDismissal = assignment.dueDate at this moment
    const dismissal = await prisma.alertDismissal.create({
      data: {
        assignmentId,
        dismissedByUserId: session.user.id,
        dueDateAtDismissal: assignment.dueDate,
      },
    });

    return NextResponse.json({ success: true, dismissal }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
