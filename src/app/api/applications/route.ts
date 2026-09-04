import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role, ApplicationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// POST /api/applications -> Restricted strictly to PROGRAM_OFFICER
export async function POST(request: Request) {
  try {
    const session = await requireRole([Role.PROGRAM_OFFICER]);
    const body = await request.json();

    const { orgName, contactEmail, fundingRound, amountRequested } = body;

    if (!orgName || !contactEmail || !fundingRound || !amountRequested) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const application = await prisma.application.create({
      data: {
        orgName,
        contactEmail,
        fundingRound,
        amountRequested,
        submissionDate: new Date(),
        ownerId: session.user.id,
        status: ApplicationStatus.SUBMITTED,
      },
    });

    return NextResponse.json({ success: true, application }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
