import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// POST /api/applications/[id]/assign -> Restricted strictly to PROGRAM_OFFICER
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await requireRole([Role.PROGRAM_OFFICER]);
    const { reviewerId, dueDate } = await request.json();

    if (!reviewerId || !dueDate) {
      return NextResponse.json({ error: 'Missing reviewerId or dueDate' }, { status: 400 });
    }

    const assignment = await prisma.assignment.create({
      data: {
        applicationId: id,
        reviewerId,
        dueDate: new Date(dueDate),
      },
    });

    return NextResponse.json({ success: true, assignment }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
