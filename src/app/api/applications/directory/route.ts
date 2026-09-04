import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Role, ApplicationStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // 1. Search Param Extraction & Defaults
    const query = searchParams.get('query')?.trim() || '';
    const fundingRound = searchParams.get('fundingRound') || '';
    const status = searchParams.get('status') as ApplicationStatus | '' || '';
    const ownerId = searchParams.get('ownerId') || '';
    const overdueOnly = searchParams.get('overdueOnly') === 'true';
    const includeArchived = searchParams.get('includeArchived') === 'true';

    // Sort params
    const sortBy = searchParams.get('sortBy') || 'submissionDate'; // submissionDate, amountRequested, status
    const sortOrder = (searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc') as Prisma.SortOrder;

    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10));
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // 2. Build Prisma `where` clause
    const where: Prisma.ApplicationWhereInput = {};

    // Archival scope
    if (!includeArchived) {
      where.archived = false;
    }

    // Role-based scope (Reviewers only see their assigned applications)
    if (session.user.role === Role.REVIEWER) {
      where.assignments = {
        some: {
          reviewerId: session.user.id,
          removedAt: null,
        },
      };
    } else if (ownerId) {
      where.ownerId = ownerId;
    }

    // Text search over orgName + contactEmail (case-insensitive, partial)
    if (query) {
      where.OR = [
        { orgName: { contains: query, mode: 'insensitive' } },
        { contactEmail: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Exact filter: fundingRound
    if (fundingRound) {
      where.fundingRound = fundingRound;
    }

    // Exact filter: status
    if (status) {
      where.status = status;
    }

    // Overdue reviews filter (Assignment where dueDate < NOW AND removedAt IS NULL AND no COMPLETED review)
    if (overdueOnly) {
      where.assignments = {
        some: {
          removedAt: null,
          dueDate: { lt: new Date() },
          reviews: {
            none: { status: 'COMPLETED' },
          },
        },
      };
    }

    // 3. Build Prisma `orderBy` clause
    let orderBy: Prisma.ApplicationOrderByWithRelationInput = { submissionDate: sortOrder };

    if (sortBy === 'amountRequested') {
      orderBy = { amountRequested: sortOrder };
    } else if (sortBy === 'status') {
      orderBy = { status: sortOrder };
    }

    // 4. Run Prisma parallel queries: data query + count query
    const [applications, totalCount] = await prisma.$transaction([
      prisma.application.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          assignments: {
            where: { removedAt: null },
            include: {
              reviewer: { select: { name: true } },
              reviews: { select: { status: true } },
            },
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    // 5. Calculate range summary ("Showing X-Y of Z")
    const startCount = totalCount === 0 ? 0 : skip + 1;
    const endCount = Math.min(skip + applications.length, totalCount);

    return NextResponse.json({
      applications,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        startCount,
        endCount,
        rangeText: `Showing ${startCount}-${endCount} of ${totalCount}`,
      },
    });
  } catch (error) {
    console.error('Error fetching applications directory:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
