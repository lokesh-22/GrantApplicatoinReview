import { ReviewStatus, TimelineEventType, ApplicationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { transitionApplicationStatus } from '@/lib/stateMachine';

export class AssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssignmentError';
  }
}

/**
 * Reusable single core function to assign a reviewer to an application.
 * Enforces COI checks, active workload cap (<=5), and due date setting.
 * Reusable for single and bulk assignment.
 */
export async function assignReviewerToApplication(
  applicationId: string,
  reviewerId: string,
  dueDate: Date,
  actorId: string
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Check for Conflict of Interest
    const conflict = await tx.conflictOfInterest.findFirst({
      where: { applicationId, reviewerId },
    });

    if (conflict) {
      throw new AssignmentError('Cannot assign reviewer: A Conflict of Interest has been declared for this application.');
    }

    // 2. Check Reviewer Active Workload Cap (<= 5)
    // Active = removedAt is null AND review status is NOT COMPLETED
    const activeAssignments = await tx.assignment.findMany({
      where: {
        reviewerId,
        removedAt: null,
      },
      include: {
        reviews: {
          where: { status: ReviewStatus.COMPLETED },
        },
      },
    });

    const activeCount = activeAssignments.filter((asgn) => asgn.reviews.length === 0).length;

    if (activeCount >= 5) {
      throw new AssignmentError(
        `Cannot assign reviewer: Reviewer has reached the maximum cap of 5 active assignments (current active: ${activeCount}).`
      );
    }

    // 3. Create Assignment
    const assignment = await tx.assignment.create({
      data: {
        applicationId,
        reviewerId,
        dueDate,
      },
      include: {
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });

    // 4. Record TimelineEvent (ASSIGNED)
    await tx.timelineEvent.create({
      data: {
        applicationId,
        type: TimelineEventType.ASSIGNED,
        actorId,
        newValue: assignment.reviewer.name,
        note: `Assigned reviewer ${assignment.reviewer.name} with due date ${dueDate.toISOString().split('T')[0]}`,
      },
    });

    // Dispatch Notification Hook
    const appInfo = await tx.application.findUnique({
      where: { id: applicationId },
      select: { orgName: true, fundingRound: true },
    });

    if (appInfo && assignment.reviewer) {
      const { sendNotification } = await import('@/lib/notificationService');
      await sendNotification({
        type: 'REVIEWER_ASSIGNED',
        recipientEmail: assignment.reviewer.email,
        recipientName: assignment.reviewer.name,
        applicationOrg: appInfo.orgName,
        fundingRound: appInfo.fundingRound,
        extraInfo: dueDate.toISOString().split('T')[0],
      });
    }

    // 5. Auto transition SUBMITTED -> ASSIGNED if application is currently SUBMITTED
    const app = await tx.application.findUnique({ where: { id: applicationId } });
    if (app && app.status === ApplicationStatus.SUBMITTED) {
      await transitionApplicationStatus(applicationId, ApplicationStatus.ASSIGNED, actorId);
    }

    return assignment;
  });
}

/**
 * Remove an assignment (soft removal via removedAt).
 * Only allowed if review is not COMPLETED.
 */
export async function removeAssignmentFromApplication(
  assignmentId: string,
  actorId: string
) {
  return await prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        reviews: { where: { status: ReviewStatus.COMPLETED } },
        reviewer: { select: { name: true } },
      },
    });

    if (!assignment) {
      throw new AssignmentError('Assignment not found.');
    }

    if (assignment.reviews.length > 0) {
      throw new AssignmentError('Cannot remove assignment: Reviewer has already COMPLETED their review.');
    }

    const updatedAssignment = await tx.assignment.update({
      where: { id: assignmentId },
      data: { removedAt: new Date() },
    });

    // Write TimelineEvent (ASSIGNMENT_REMOVED)
    await tx.timelineEvent.create({
      data: {
        applicationId: assignment.applicationId,
        type: TimelineEventType.ASSIGNMENT_REMOVED,
        actorId,
        oldValue: assignment.reviewer.name,
        note: `Removed assignment for reviewer ${assignment.reviewer.name}`,
      },
    });

    return updatedAssignment;
  });
}

/**
 * Update assignment due date.
 * Allowed any time before COMPLETED.
 */
export async function updateAssignmentDueDate(
  assignmentId: string,
  newDueDate: Date
) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      reviews: { where: { status: ReviewStatus.COMPLETED } },
    },
  });

  if (!assignment) {
    throw new AssignmentError('Assignment not found.');
  }

  if (assignment.reviews.length > 0) {
    throw new AssignmentError('Cannot update due date: Reviewer has already COMPLETED their review.');
  }

  return await prisma.assignment.update({
    where: { id: assignmentId },
    data: { dueDate: newDueDate },
  });
}
