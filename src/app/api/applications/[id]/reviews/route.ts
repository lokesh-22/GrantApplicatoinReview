import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ReviewStatus, Role } from '@prisma/client';

// GET /api/applications/[id]/reviews -> View reviews according to privacy rules:
// - All COMPLETED reviews are visible to all authenticated users.
// - DRAFT reviews are visible ONLY to the reviewer who created them.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const reviews = await prisma.review.findMany({
      where: {
        applicationId: id,
        OR: [
          { status: ReviewStatus.COMPLETED },
          { reviewerId: session.user.id }, // Drafts visible only to owner
        ],
      },
      include: {
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
