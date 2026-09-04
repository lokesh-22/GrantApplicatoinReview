import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role, ReviewStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface ReviewerCalibrationItem {
  reviewerId: string;
  reviewerName: string;
  reviewerEmail: string;
  completedReviewsCount: number;
  reviewerAvg: {
    impact: number;
    feasibility: number;
    budget: number;
    overall: number;
  };
  panelAvg: {
    impact: number;
    feasibility: number;
    budget: number;
    overall: number;
  };
  delta: {
    impact: number;
    feasibility: number;
    budget: number;
    overall: number;
  };
  maxAbsoluteDelta: number;
}

// GET /api/reports/calibration -> Reviewer Calibration report for Program Officers
export async function GET() {
  try {
    await requireRole([Role.PROGRAM_OFFICER]);

    // 1. Single Prisma groupBy query to get completed review counts and average scores per reviewer
    const reviewerStats = await prisma.review.groupBy({
      by: ['reviewerId'],
      where: {
        status: ReviewStatus.COMPLETED,
        impactScore: { not: null },
        feasibilityScore: { not: null },
        budgetScore: { not: null },
      },
      _count: {
        id: true,
      },
      _avg: {
        impactScore: true,
        feasibilityScore: true,
        budgetScore: true,
      },
      having: {
        reviewerId: {
          _count: {
            gte: 3, // Only reviewers with >= 3 completed reviews
          },
        },
      },
    });

    if (reviewerStats.length === 0) {
      return NextResponse.json({ report: [] });
    }

    const reviewerIds = reviewerStats.map((s) => s.reviewerId);

    // Fetch Reviewer user details
    const reviewers = await prisma.user.findMany({
      where: { id: { in: reviewerIds } },
      select: { id: true, name: true, email: true },
    });

    const report: ReviewerCalibrationItem[] = [];

    // 2. Compute reviewer averages vs. panel averages for the exact same applications
    for (const stat of reviewerStats) {
      const reviewer = reviewers.find((r) => r.id === stat.reviewerId);
      if (!reviewer) continue;

      // Find all applications completed by this reviewer
      const reviewerCompletedReviews = await prisma.review.findMany({
        where: {
          reviewerId: stat.reviewerId,
          status: ReviewStatus.COMPLETED,
        },
        select: { applicationId: true },
      });

      const applicationIds = reviewerCompletedReviews.map((r) => r.applicationId);

      // Compute panel average for the EXACT same applications (across all reviewers)
      const panelAggregate = await prisma.review.aggregate({
        where: {
          applicationId: { in: applicationIds },
          status: ReviewStatus.COMPLETED,
          impactScore: { not: null },
          feasibilityScore: { not: null },
          budgetScore: { not: null },
        },
        _avg: {
          impactScore: true,
          feasibilityScore: true,
          budgetScore: true,
        },
      });

      const revImpact = stat._avg.impactScore || 0;
      const revFeasibility = stat._avg.feasibilityScore || 0;
      const revBudget = stat._avg.budgetScore || 0;
      const revOverall = (revImpact + revFeasibility + revBudget) / 3;

      const panelImpact = panelAggregate._avg.impactScore || 0;
      const panelFeasibility = panelAggregate._avg.feasibilityScore || 0;
      const panelBudget = panelAggregate._avg.budgetScore || 0;
      const panelOverall = (panelImpact + panelFeasibility + panelBudget) / 3;

      const deltaImpact = revImpact - panelImpact;
      const deltaFeasibility = revFeasibility - panelFeasibility;
      const deltaBudget = revBudget - panelBudget;
      const deltaOverall = revOverall - panelOverall;

      const maxAbsDelta = Math.max(
        Math.abs(deltaImpact),
        Math.abs(deltaFeasibility),
        Math.abs(deltaBudget)
      );

      report.push({
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        reviewerEmail: reviewer.email,
        completedReviewsCount: stat._count.id,
        reviewerAvg: {
          impact: Number(revImpact.toFixed(2)),
          feasibility: Number(revFeasibility.toFixed(2)),
          budget: Number(revBudget.toFixed(2)),
          overall: Number(revOverall.toFixed(2)),
        },
        panelAvg: {
          impact: Number(panelImpact.toFixed(2)),
          feasibility: Number(panelFeasibility.toFixed(2)),
          budget: Number(panelBudget.toFixed(2)),
          overall: Number(panelOverall.toFixed(2)),
        },
        delta: {
          impact: Number(deltaImpact.toFixed(2)),
          feasibility: Number(deltaFeasibility.toFixed(2)),
          budget: Number(deltaBudget.toFixed(2)),
          overall: Number(deltaOverall.toFixed(2)),
        },
        maxAbsoluteDelta: Number(maxAbsDelta.toFixed(2)),
      });
    }

    // 3. Sort by largest absolute delta first so outlier reviewers surface at the top
    report.sort((a, b) => b.maxAbsoluteDelta - a.maxAbsoluteDelta);

    return NextResponse.json({ report });
  } catch (error) {
    return handleAuthError(error);
  }
}
