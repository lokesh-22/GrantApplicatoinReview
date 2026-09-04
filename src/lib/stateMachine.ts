import { ApplicationStatus, ReviewStatus, TimelineEventType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class InvalidStatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * Explicit server-side state machine for Application status transitions.
 * 
 * Rules:
 * 1. SUBMITTED -> ASSIGNED: Allowed when >= 1 reviewer assignment exists.
 * 2. ASSIGNED -> UNDER_REVIEW: Manual Program Officer action.
 * 3. UNDER_REVIEW -> DECIDED: Only if >= 3 COMPLETED reviews exist.
 * 
 * Any invalid transition throws an InvalidStatusTransitionError explaining why.
 * On success, atomically updates application status and writes an append-only TimelineEvent (STATUS_CHANGED).
 */
export async function transitionApplicationStatus(
  applicationId: string,
  targetStatus: ApplicationStatus,
  actorId: string
) {
  return await prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id: applicationId },
      include: {
        assignments: { where: { removedAt: null } },
        reviews: { where: { status: ReviewStatus.COMPLETED } },
      },
    });

    if (!application) {
      throw new Error('Application not found');
    }

    const currentStatus = application.status;

    // No-op if target status is identical
    if (currentStatus === targetStatus) {
      return application;
    }

    // Explicit State Machine Validation
    if (currentStatus === ApplicationStatus.SUBMITTED && targetStatus === ApplicationStatus.ASSIGNED) {
      const activeAssignmentsCount = application.assignments.length;
      if (activeAssignmentsCount < 1) {
        throw new InvalidStatusTransitionError(
          `Cannot transition to ASSIGNED: Application must have at least 1 active reviewer assignment (current: ${activeAssignmentsCount}).`
        );
      }
    } else if (currentStatus === ApplicationStatus.ASSIGNED && targetStatus === ApplicationStatus.UNDER_REVIEW) {
      // Allowed manual PO transition
    } else if (currentStatus === ApplicationStatus.UNDER_REVIEW && targetStatus === ApplicationStatus.DECIDED) {
      const completedReviewsCount = application.reviews.length;
      if (completedReviewsCount < 3) {
        throw new InvalidStatusTransitionError(
          `Cannot transition to DECIDED: Requires at least 3 COMPLETED reviews (current: ${completedReviewsCount} / 3 required).`
        );
      }
    } else {
      // Reject any invalid jump/backwards transition
      throw new InvalidStatusTransitionError(
        `Invalid status transition from ${currentStatus} to ${targetStatus}. Allowed sequence: SUBMITTED -> ASSIGNED -> UNDER_REVIEW -> DECIDED.`
      );
    }

    // Update Application Status
    const updatedApplication = await tx.application.update({
      where: { id: applicationId },
      data: { status: targetStatus },
    });

    // Append TimelineEvent (STATUS_CHANGED)
    await tx.timelineEvent.create({
      data: {
        applicationId,
        type: TimelineEventType.STATUS_CHANGED,
        oldValue: currentStatus,
        newValue: targetStatus,
        actorId,
        note: `Status updated from ${currentStatus} to ${targetStatus}`,
      },
    });

    // Dispatch Notification Hook if status is DECIDED
    if (targetStatus === ApplicationStatus.DECIDED) {
      const appOwner = await tx.application.findUnique({
        where: { id: applicationId },
        include: { owner: { select: { name: true, email: true } } },
      });

      if (appOwner && appOwner.owner) {
        const { sendNotification } = await import('@/lib/notificationService');
        await sendNotification({
          type: 'APPLICATION_DECIDED',
          recipientEmail: appOwner.owner.email,
          recipientName: appOwner.owner.name,
          applicationOrg: appOwner.orgName,
          fundingRound: appOwner.fundingRound,
        });
      }
    }

    return updatedApplication;
  });
}
