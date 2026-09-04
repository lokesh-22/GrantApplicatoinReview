import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// POST /api/conflicts -> Declare a conflict of interest
export async function POST(request: Request) {
  try {
    const session = await requireRole([Role.REVIEWER]);
    const { applicationId, reason } = await request.json();

    if (!applicationId || !reason || !reason.trim()) {
      return NextResponse.json({ error: 'Application ID and a valid reason are required.' }, { status: 400 });
    }

    const conflict = await prisma.conflictOfInterest.create({
      data: {
        applicationId,
        reviewerId: session.user.id,
        reason: reason.trim(),
      },
    });

    return NextResponse.json({ success: true, conflict }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
