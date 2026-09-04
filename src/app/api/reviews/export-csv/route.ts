import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/rbac';
import { Role, ReviewStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// GET /api/reviews/export-csv?fundingRound=... -> Export CSV of COMPLETED reviews
export async function GET(request: Request) {
  try {
    await requireRole([Role.PROGRAM_OFFICER]);
    const { searchParams } = new URL(request.url);
    const fundingRound = searchParams.get('fundingRound');

    if (!fundingRound) {
      return NextResponse.json({ error: 'fundingRound query parameter is required' }, { status: 400 });
    }

    // Fetch all COMPLETED reviews for applications in the funding round
    const reviews = await prisma.review.findMany({
      where: {
        status: ReviewStatus.COMPLETED,
        application: { fundingRound },
      },
      include: {
        application: { select: { id: true, orgName: true } },
        reviewer: { select: { name: true } },
      },
      orderBy: { completedAt: 'desc' },
    });

    // Generate CSV Header & Rows with separate columns for each criterion score
    const csvHeaders = [
      'Applicant Org',
      'Application ID',
      'Reviewer Name',
      'Impact Score',
      'Feasibility Score',
      'Budget Score',
      'Comments',
      'Completed Date',
    ];

    const escapeCsv = (str: string | number | null | undefined) => {
      if (str === null || str === undefined) return '""';
      const text = String(str).replace(/"/g, '""');
      return `"${text}"`;
    };

    const csvRows = reviews.map((r) => [
      escapeCsv(r.application.orgName),
      escapeCsv(r.application.id),
      escapeCsv(r.reviewer.name),
      escapeCsv(r.impactScore),
      escapeCsv(r.feasibilityScore),
      escapeCsv(r.budgetScore),
      escapeCsv(r.comments),
      escapeCsv(r.completedAt ? new Date(r.completedAt).toISOString().split('T')[0] : ''),
    ]);

    const csvContent = [csvHeaders.join(','), ...csvRows.map((row) => row.join(','))].join('\n');

    const filename = `reviews-${fundingRound.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
