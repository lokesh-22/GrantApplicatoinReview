import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// GET /api/users/reviewers -> Fetch list of Reviewers
export async function GET() {
  try {
    await requireRole([Role.PROGRAM_OFFICER]);
    const reviewers = await prisma.user.findMany({
      where: { role: Role.REVIEWER },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ reviewers });
  } catch (error) {
    return handleAuthError(error);
  }
}
