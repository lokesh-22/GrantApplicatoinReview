import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role, ApplicationStatus } from '@prisma/client';
import { transitionApplicationStatus, InvalidStatusTransitionError } from '@/lib/stateMachine';

// PUT /api/applications/[id]/status -> Transition application status via state machine
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole([Role.PROGRAM_OFFICER]);
    const { id } = await context.params;
    const { targetStatus } = await request.json();

    if (!targetStatus || !Object.values(ApplicationStatus).includes(targetStatus)) {
      return NextResponse.json({ error: 'Valid targetStatus is required' }, { status: 400 });
    }

    try {
      const application = await transitionApplicationStatus(id, targetStatus, session.user.id);
      return NextResponse.json({ success: true, application });
    } catch (err) {
      if (err instanceof InvalidStatusTransitionError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  } catch (error) {
    return handleAuthError(error);
  }
}
