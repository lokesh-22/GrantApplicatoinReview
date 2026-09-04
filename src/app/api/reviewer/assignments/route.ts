import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// GET /api/reviewer/assignments -> Fetch assigned applications for logged-in Reviewer
export async function GET() {
  try {
    const session = await requireRole([Role.REVIEWER]);

    const assignments = await prisma.assignment.findMany({
      where: {
        reviewerId: session.user.id,
        removedAt: null, // Only active assignments
      },
      include: {
        application: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
            reviews: {
              where: { reviewerId: session.user.id },
            },
            conflicts: {
              where: { reviewerId: session.user.id },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    return handleAuthError(error);
  }
}
