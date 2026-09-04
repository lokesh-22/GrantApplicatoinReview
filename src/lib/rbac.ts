import { Role } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export interface CustomSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: Role;
  };
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden: insufficient role permissions') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized: session invalid or missing') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Server-side role enforcement helper.
 * Throws 403 Forbidden error or returns session if authorized.
 */
export async function requireRole(allowedRoles: Role[]): Promise<CustomSession> {
  const session = (await getServerSession(authOptions)) as CustomSession | null;

  if (!session || !session.user) {
    throw new UnauthorizedError();
  }

  if (!allowedRoles.includes(session.user.role)) {
    throw new ForbiddenError();
  }

  return session;
}

/**
 * Standard HTTP Error Response helper for API routes.
 */
export function handleAuthError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  console.error('Unhandled API Error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}
