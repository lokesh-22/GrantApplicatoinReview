import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role, ApplicationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// GET /api/funding-rounds/budget-progress?fundingRound=... -> Compute DECIDED requested sum vs totalPool
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fundingRound = searchParams.get('fundingRound');

    if (!fundingRound) {
      return NextResponse.json({ error: 'fundingRound parameter required' }, { status: 400 });
    }

    // 1. Fetch totalPool config for this funding round
    const config = await prisma.fundingRoundConfig.findUnique({
      where: { roundName: fundingRound },
    });

    const totalPool = config?.totalPool ? Number(config.totalPool) : null;

    // If no totalPool is set for this round, return poolSet: false
    if (!totalPool || totalPool <= 0) {
      return NextResponse.json({
        poolSet: false,
        fundingRound,
      });
    }

    // 2. Aggregate sum of amountRequested for DECIDED applications in this round
    const decidedAggregate = await prisma.application.aggregate({
      where: {
        fundingRound,
        status: ApplicationStatus.DECIDED,
        archived: false,
      },
      _sum: {
        amountRequested: true,
      },
    });

    const allocatedAmount = Number(decidedAggregate._sum.amountRequested || 0);
    const percentageUsed = Math.min(100, (allocatedAmount / totalPool) * 100);

    return NextResponse.json({
      poolSet: true,
      fundingRound,
      totalPool,
      allocatedAmount,
      percentageUsed: Number(percentageUsed.toFixed(1)),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
