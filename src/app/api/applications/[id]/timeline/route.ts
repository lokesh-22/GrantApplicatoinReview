import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Role, TimelineEventType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// GET /api/applications/[id]/timeline -> Retrieve chronological timeline events for application
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

    // Visibility Check: Reviewers can only view timeline for applications they are assigned to
    if (session.user.role === Role.REVIEWER) {
      const assignment = await prisma.assignment.findFirst({
        where: {
          applicationId: id,
          reviewerId: session.user.id,
          removedAt: null,
        },
      });

      if (!assignment) {
        return NextResponse.json({ error: 'Forbidden: You are not assigned to this application.' }, { status: 403 });
      }
    }

    const timelineEvents = await prisma.timelineEvent.findMany({
      where: { applicationId: id },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'asc' }, // Chronological
    });

    return NextResponse.json({ timelineEvents });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/applications/[id]/timeline -> Leave a comment on the application (Creates TimelineEvent type = COMMENT)
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const { note } = await request.json();

    if (!note || !note.trim()) {
      return NextResponse.json({ error: 'Comment text (note) is required.' }, { status: 400 });
    }

    // Visibility Check: Reviewers can only comment on applications they are assigned to
    if (session.user.role === Role.REVIEWER) {
      const assignment = await prisma.assignment.findFirst({
        where: {
          applicationId: id,
          reviewerId: session.user.id,
          removedAt: null,
        },
      });

      if (!assignment) {
        return NextResponse.json({ error: 'Forbidden: You are not assigned to this application.' }, { status: 403 });
      }
    }

    // Write TimelineEvent (COMMENT) - strictly append-only creation
    const timelineEvent = await prisma.timelineEvent.create({
      data: {
        applicationId: id,
        type: TimelineEventType.COMMENT,
        actorId: session.user.id,
        note: note.trim(),
      },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return NextResponse.json({ success: true, timelineEvent }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
