import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// GET /api/funding-rounds/config -> Fetch all funding round pool configs
export async function GET() {
  try {
    const configs = await prisma.fundingRoundConfig.findMany({
      orderBy: { roundName: 'asc' },
    });

    return NextResponse.json({ configs });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/funding-rounds/config -> Set or update totalPool for a funding round
export async function POST(request: Request) {
  try {
    await requireRole([Role.PROGRAM_OFFICER]);
    const { roundName, totalPool } = await request.json();

    if (!roundName || !roundName.trim()) {
      return NextResponse.json({ error: 'roundName is required' }, { status: 400 });
    }

    const parsedPool = totalPool !== undefined && totalPool !== null && totalPool !== ''
      ? Number(totalPool).toFixed(2)
      : null;

    if (parsedPool !== null && (isNaN(Number(parsedPool)) || Number(parsedPool) <= 0)) {
      return NextResponse.json({ error: 'totalPool must be a positive number' }, { status: 400 });
    }

    const config = await prisma.fundingRoundConfig.upsert({
      where: { roundName: roundName.trim() },
      update: { totalPool: parsedPool },
      create: { roundName: roundName.trim(), totalPool: parsedPool },
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    return handleAuthError(error);
  }
}
