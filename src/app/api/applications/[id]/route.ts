import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// GET /api/applications/[id] -> Fetch single application
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([Role.PROGRAM_OFFICER]);
    const { id } = await context.params;

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json({ application });
  } catch (error) {
    return handleAuthError(error);
  }
}

// PUT /api/applications/[id] -> Update application fields (edit / archive / restore / reassign owner)
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([Role.PROGRAM_OFFICER]);
    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.application.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    if (body.orgName !== undefined) updateData.orgName = body.orgName.trim();
    if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail.trim();
    if (body.fundingRound !== undefined) updateData.fundingRound = body.fundingRound.trim();
    if (body.amountRequested !== undefined) {
      const numAmount = Number(body.amountRequested);
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: 'Amount requested must be positive' }, { status: 400 });
      }
      updateData.amountRequested = numAmount.toFixed(2);
    }
    if (body.submissionDate !== undefined) updateData.submissionDate = new Date(body.submissionDate);
    if (body.ownerId !== undefined) updateData.ownerId = body.ownerId;
    if (body.archived !== undefined) updateData.archived = Boolean(body.archived);

    const updatedApp = await prisma.application.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ success: true, application: updatedApp });
  } catch (error) {
    return handleAuthError(error);
  }
}
