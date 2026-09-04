import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role, ApplicationStatus, ReviewStatus, TimelineEventType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await requireRole([Role.PROGRAM_OFFICER]);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Stat Cards (Prisma count / aggregate)

    // Open applications (not archived, not DECIDED)
    const openApplicationsCount = await prisma.application.count({
      where: {
        archived: false,
        status: { not: ApplicationStatus.DECIDED },
      },
    });

    // Overdue-for-review count (applications with active assignments overdue and not completed)
    const overdueCount = await prisma.application.count({
      where: {
        archived: false,
        status: { not: ApplicationStatus.DECIDED },
        assignments: {
          some: {
            removedAt: null,
            dueDate: { lt: now },
            reviews: { none: { status: ReviewStatus.COMPLETED } },
          },
        },
      },
    });

    // Ready-for-decision count (UNDER_REVIEW with >= 3 COMPLETED reviews)
    // Query applications in UNDER_REVIEW status
    const underReviewApps = await prisma.application.findMany({
      where: {
        archived: false,
        status: ApplicationStatus.UNDER_REVIEW,
      },
      select: {
        id: true,
        reviews: {
          where: { status: ReviewStatus.COMPLETED },
          select: { id: true },
        },
      },
    });
    const readyForDecisionCount = underReviewApps.filter((app) => app.reviews.length >= 3).length;

    // Amount requested this month (sum where submissionDate is in current calendar month)
    const amountSumAggregate = await prisma.application.aggregate({
      where: {
        archived: false,
        submissionDate: { gte: startOfMonth },
      },
      _sum: {
        amountRequested: true,
      },
    });
    const amountRequestedThisMonth = amountSumAggregate._sum.amountRequested?.toString() || '0.00';

    // 2. Bar Breakdowns using Prisma groupBy

    // Breakdown by Status
    const statusGroups = await prisma.application.groupBy({
      by: ['status'],
      where: { archived: false },
      _count: { id: true },
    });
    const statusBreakdown = statusGroups.map((g) => ({
      status: g.status,
      count: g._count.id,
    }));

    // Breakdown by Funding Round
    const roundGroups = await prisma.application.groupBy({
      by: ['fundingRound'],
      where: { archived: false },
      _count: { id: true },
    });
    const fundingRoundBreakdown = roundGroups.map((g) => ({
      fundingRound: g.fundingRound,
      count: g._count.id,
    }));

    // 3. Applications DECIDED per week (last 8 weeks)
    // Pull from TimelineEvent where type = STATUS_CHANGED and newValue = DECIDED
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);

    const decidedTimelineEvents = await prisma.timelineEvent.findMany({
      where: {
        type: TimelineEventType.STATUS_CHANGED,
        newValue: ApplicationStatus.DECIDED,
        createdAt: { gte: eightWeeksAgo },
      },
      select: {
        createdAt: true,
      },
    });

    // Group TimelineEvents into 8 weekly buckets
    const weeklyBuckets: { weekLabel: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);

      const count = decidedTimelineEvents.filter(
        (e) => e.createdAt >= weekStart && e.createdAt < weekEnd
      ).length;

      const weekLabel = `W-${i + 1} (${weekStart.getMonth() + 1}/${weekStart.getDate()})`;
      weeklyBuckets.push({ weekLabel, count });
    }

    return NextResponse.json({
      cards: {
        openApplicationsCount,
        overdueCount,
        readyForDecisionCount,
        amountRequestedThisMonth,
      },
      statusBreakdown,
      fundingRoundBreakdown,
      decidedWeeklyTrend: weeklyBuckets,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
