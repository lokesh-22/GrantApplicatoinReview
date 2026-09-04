import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role, ApplicationStatus, TimelineEventType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// GET /api/applications -> List active applications (excluding archived by default unless includeArchived=true)
export async function GET(request: Request) {
  try {
    await requireRole([Role.PROGRAM_OFFICER]);
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const applications = await prisma.application.findMany({
      where: includeArchived ? {} : { archived: false },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ applications });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/applications -> Create application
export async function POST(request: Request) {
  try {
    const session = await requireRole([Role.PROGRAM_OFFICER]);
    const body = await request.json();

    const { orgName, contactEmail, fundingRound, amountRequested, submissionDate, ownerId } = body;

    // Validate fields
    if (!orgName || !contactEmail || !fundingRound || amountRequested === undefined || amountRequested === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const numAmount = Number(amountRequested);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Amount requested must be a positive number' }, { status: 400 });
    }

    const targetOwnerId = ownerId || session.user.id;

    // Execute application creation and timeline event in transaction
    const application = await prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          orgName: orgName.trim(),
          contactEmail: contactEmail.trim(),
          fundingRound: fundingRound.trim(),
          amountRequested: numAmount.toFixed(2),
          submissionDate: submissionDate ? new Date(submissionDate) : new Date(),
          ownerId: targetOwnerId,
          status: ApplicationStatus.SUBMITTED,
          archived: false,
        },
        include: { owner: true },
      });

      // Write TimelineEvent (CREATED)
      await tx.timelineEvent.create({
        data: {
          applicationId: app.id,
          type: TimelineEventType.CREATED,
          actorId: session.user.id,
          note: `Application created for ${app.orgName}`,
        },
      });

      return app;
    });

    return NextResponse.json({ success: true, application }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
