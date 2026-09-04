import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  assignReviewerToApplication,
  removeAssignmentFromApplication,
  updateAssignmentDueDate,
  AssignmentError,
} from '@/lib/assignmentService';

// GET /api/applications/[id]/assignments -> List active & historical assignments for application
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([Role.PROGRAM_OFFICER]);
    const { id } = await context.params;

    const assignments = await prisma.assignment.findMany({
      where: { applicationId: id },
      include: {
        reviewer: { select: { id: true, name: true, email: true } },
        reviews: { select: { id: true, status: true, completedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/applications/[id]/assign -> Assign reviewer using assignReviewerToApplication helper
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole([Role.PROGRAM_OFFICER]);
    const { id } = await context.params;
    const { reviewerId, dueDate } = await request.json();

    if (!reviewerId || !dueDate) {
      return NextResponse.json({ error: 'reviewerId and valid dueDate are required' }, { status: 400 });
    }

    try {
      const assignment = await assignReviewerToApplication(
        id,
        reviewerId,
        new Date(dueDate),
        session.user.id
      );
      return NextResponse.json({ success: true, assignment }, { status: 201 });
    } catch (err) {
      if (err instanceof AssignmentError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  } catch (error) {
    return handleAuthError(error);
  }
}

// DELETE /api/applications/[id]/assign?assignmentId=xxx -> Soft remove assignment
export async function DELETE(
  request: Request
) {
  try {
    const session = await requireRole([Role.PROGRAM_OFFICER]);
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId parameter required' }, { status: 400 });
    }

    try {
      const assignment = await removeAssignmentFromApplication(assignmentId, session.user.id);
      return NextResponse.json({ success: true, assignment });
    } catch (err) {
      if (err instanceof AssignmentError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  } catch (error) {
    return handleAuthError(error);
  }
}

// PUT /api/applications/[id]/assign -> Update due date
export async function PUT(
  request: Request
) {
  try {
    await requireRole([Role.PROGRAM_OFFICER]);
    const { assignmentId, dueDate } = await request.json();

    if (!assignmentId || !dueDate) {
      return NextResponse.json({ error: 'assignmentId and valid dueDate are required' }, { status: 400 });
    }

    try {
      const assignment = await updateAssignmentDueDate(assignmentId, new Date(dueDate));
      return NextResponse.json({ success: true, assignment });
    } catch (err) {
      if (err instanceof AssignmentError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  } catch (error) {
    return handleAuthError(error);
  }
}
