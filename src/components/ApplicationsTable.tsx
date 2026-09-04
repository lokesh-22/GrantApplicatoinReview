'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import AssignmentDrawer from '@/components/AssignmentDrawer';
import ApplicationTimelineModal from '@/components/ApplicationTimelineModal';
import FundingPoolProgressBar from '@/components/FundingPoolProgressBar';

interface Application {
  id: string;
  orgName: string;
  contactEmail: string;
  fundingRound: string;
  amountRequested: string;
  submissionDate: string;
  status: string;
  archived: boolean;
  ownerId: string;
  owner: { id: string; name: string; email: string };
  assignments: {
    id: string;
    dueDate: string;
    reviewer: { name: string };
    reviews: { status: string }[];
  }[];
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  startCount: number;
  endCount: number;
  rangeText: string;
}

interface ProgramOfficer {
  id: string;
  name: string;
  email: string;
}

export default function ApplicationsTable() {
  const { data: session } = useSession();
  const [applications, setApplications] = useState<Application[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 1,
    startCount: 0,
    endCount: 0,
    rangeText: 'Showing 0-0 of 0',
  });

  const [programOfficers, setProgramOfficers] = useState<ProgramOfficer[]>([]);

  // Filter & Search & Sort State
  const [query, setQuery] = useState('');
  const [fundingRound, setFundingRound] = useState('');
  const [status, setStatus] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sortBy, setSortBy] = useState('submissionDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  // Drawer & Modal state
  const [assigningAppId, setAssigningAppId] = useState<string | null>(null);
  const [timelineAppId, setTimelineAppId] = useState<string | null>(null);

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        query,
        fundingRound,
        status,
        ownerId,
        overdueOnly: String(overdueOnly),
        includeArchived: String(includeArchived),
        sortBy,
        sortOrder,
        page: String(page),
        pageSize: String(pageSize),
      });

      const res = await fetch(`/api/applications/directory?${params.toString()}`);
      const data = await res.json();

      if (data.applications) {
        setApplications(data.applications);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch applications directory:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgramOfficers = async () => {
    try {
      const res = await fetch('/api/users/program-officers');
      const data = await res.json();
      if (data.programOfficers) setProgramOfficers(data.programOfficers);
    } catch (err) {
      console.error('Failed to fetch program officers:', err);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, [query, fundingRound, status, ownerId, overdueOnly, includeArchived, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    if (session?.user?.role === 'PROGRAM_OFFICER') {
      fetchProgramOfficers();
    }
  }, [session]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Search & Filter Bar */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Search Org / Contact</label>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Funding Round</label>
            <select
              value={fundingRound}
              onChange={(e) => { setFundingRound(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
            >
              <option value="">All Rounds</option>
              <option value="FY2024-Q1 Tech Innovation">FY2024-Q1 Tech Innovation</option>
              <option value="FY2024-Q2 Health & Bio">FY2024-Q2 Health & Bio</option>
              <option value="FY2024-Q3 Climate Resilience">FY2024-Q3 Climate Resilience</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="DECIDED">DECIDED</option>
            </select>
          </div>

          {session?.user?.role === 'PROGRAM_OFFICER' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Owner (Program Officer)</label>
              <select
                value={ownerId}
                onChange={(e) => { setOwnerId(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
              >
                <option value="">All Program Officers</option>
                {programOfficers.map((po) => (
                  <option key={po.id} value={po.id}>{po.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-700/60">
          <div className="flex gap-6 items-center">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1); }}
                className="rounded bg-slate-900 border-slate-700 text-indigo-600"
              />
              Overdue Reviews Only
            </label>

            {session?.user?.role === 'PROGRAM_OFFICER' && (
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => { setIncludeArchived(e.target.checked); setPage(1); }}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600"
                />
                Include Archived
              </label>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Per Page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Funding Pool Progress Bar (rendered when a round filter is selected and configured) */}
      {fundingRound && <FundingPoolProgressBar fundingRound={fundingRound} />}

      {/* Applications Directory Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading directory...</div>
        ) : applications.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No applications match your filter criteria.</div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-4">Organization</th>
                    <th className="px-6 py-4">Funding Round</th>
                    <th
                      className="px-6 py-4 cursor-pointer hover:text-white"
                      onClick={() => handleSort('amountRequested')}
                    >
                      Amount {sortBy === 'amountRequested' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="px-6 py-4">Owner</th>
                    <th
                      className="px-6 py-4 cursor-pointer hover:text-white"
                      onClick={() => handleSort('status')}
                    >
                      Status {sortBy === 'status' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th
                      className="px-6 py-4 cursor-pointer hover:text-white"
                      onClick={() => handleSort('submissionDate')}
                    >
                      Submitted {sortBy === 'submissionDate' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    {session?.user?.role === 'PROGRAM_OFFICER' && (
                      <th className="px-6 py-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {applications.map((app) => (
                    <tr key={app.id} className={app.archived ? 'opacity-50 bg-slate-900/30' : 'hover:bg-slate-700/30 transition-colors'}>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{app.orgName}</div>
                        <div className="text-xs text-slate-400">{app.contactEmail}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{app.fundingRound}</td>
                      <td className="px-6 py-4 font-mono text-emerald-400 font-medium">
                        ${Number(app.amountRequested).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{app.owner?.name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          app.status === 'SUBMITTED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          app.status === 'ASSIGNED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          app.status === 'UNDER_REVIEW' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {new Date(app.submissionDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => setTimelineAppId(app.id)}
                          className="text-xs font-medium text-purple-400 hover:text-purple-300 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20"
                        >
                          Timeline
                        </button>
                        {session?.user?.role === 'PROGRAM_OFFICER' && (
                          <button
                            onClick={() => setAssigningAppId(app.id)}
                            className="text-xs font-medium text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20"
                          >
                            Reviewers
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Range & Controls */}
            <div className="bg-slate-900/60 p-4 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400">
              <div>
                <span className="font-semibold text-slate-200">{pagination.rangeText}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded border border-slate-700"
                >
                  Previous
                </button>
                <span className="px-2 font-mono text-slate-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded border border-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {assigningAppId && (
        <AssignmentDrawer
          applicationId={assigningAppId}
          orgName={applications.find((a) => a.id === assigningAppId)?.orgName || ''}
          onClose={() => {
            setAssigningAppId(null);
            fetchDirectory();
          }}
        />
      )}
      {timelineAppId && (
        <ApplicationTimelineModal
          applicationId={timelineAppId}
          orgName={applications.find((a) => a.id === timelineAppId)?.orgName || ''}
          onClose={() => setTimelineAppId(null)}
        />
      )}
    </div>
  );
}
