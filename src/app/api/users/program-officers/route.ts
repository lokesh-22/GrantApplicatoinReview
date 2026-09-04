import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// GET /api/users/program-officers -> Fetch list of Program Officers for reassign owner dropdown
export async function GET() {
  try {
    await requireRole([Role.PROGRAM_OFFICER]);
    const programOfficers = await prisma.user.findMany({
      where: { role: Role.PROGRAM_OFFICER },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ programOfficers });
  } catch (error) {
    return handleAuthError(error);
  }
}
