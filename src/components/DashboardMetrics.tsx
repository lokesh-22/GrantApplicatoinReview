'use client';

import { useState, useEffect } from 'react';

interface DashboardStats {
  cards: {
    openApplicationsCount: number;
    overdueCount: number;
    readyForDecisionCount: number;
    amountRequestedThisMonth: string;
  };
  statusBreakdown: { status: string; count: number }[];
  fundingRoundBreakdown: { fundingRound: string; count: number }[];
  decidedWeeklyTrend: { weekLabel: string; count: number }[];
}

export default function DashboardMetrics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.cards) setStats(data);
      })
      .catch((err) => console.error('Failed to load dashboard metrics:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center text-slate-400">Loading dashboard analytics...</div>;
  }

  if (!stats) return null;

  const maxStatusCount = Math.max(...stats.statusBreakdown.map((s) => s.count), 1);
  const maxRoundCount = Math.max(...stats.fundingRoundBreakdown.map((r) => r.count), 1);
  const maxWeeklyCount = Math.max(...stats.decidedWeeklyTrend.map((w) => w.count), 1);

  return (
    <div className="space-y-6 font-sans">
      {/* Metrics Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Open Applications</p>
          <p className="text-3xl font-extrabold text-white mt-2">{stats.cards.openApplicationsCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Not archived & not decided</p>
        </div>

        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md">
          <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">Overdue for Review</p>
          <p className="text-3xl font-extrabold text-amber-400 mt-2">{stats.cards.overdueCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Past-due incomplete assignments</p>
        </div>

        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md">
          <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Ready for Decision</p>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">{stats.cards.readyForDecisionCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Under review with ≥3 completed reviews</p>
        </div>

        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md">
          <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider">Amount Requested (This Month)</p>
          <p className="text-2xl font-extrabold text-indigo-400 mt-2 font-mono">
            ${Number(stats.cards.amountRequestedThisMonth).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Sum of current month submissions</p>
        </div>
      </div>

      {/* Visual Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown Bar Chart */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Applications by Status</h3>
          <div className="space-y-3">
            {stats.statusBreakdown.map((item) => (
              <div key={item.status} className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span>{item.status}</span>
                  <span className="font-mono">{item.count}</span>
                </div>
                <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.status === 'SUBMITTED' ? 'bg-blue-500' :
                      item.status === 'ASSIGNED' ? 'bg-amber-500' :
                      item.status === 'UNDER_REVIEW' ? 'bg-purple-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${(item.count / maxStatusCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Funding Round Breakdown Bar Chart */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Applications by Funding Round</h3>
          <div className="space-y-3">
            {stats.fundingRoundBreakdown.map((item) => (
              <div key={item.fundingRound} className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-300">
                  <span className="truncate max-w-[200px]">{item.fundingRound}</span>
                  <span className="font-mono">{item.count}</span>
                </div>
                <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${(item.count / maxRoundCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Applications DECIDED per week (TimelineEvent-driven) */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Applications DECIDED per Week (Last 8 Weeks)</h3>
          <p className="text-xs text-slate-400">Pulled strictly from TimelineEvent status transition logs</p>
        </div>

        <div className="flex items-end gap-3 h-40 pt-4 px-2 bg-slate-900/60 rounded-xl border border-slate-700/60">
          {stats.decidedWeeklyTrend.map((bucket) => (
            <div key={bucket.weekLabel} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <span className="text-[10px] font-mono text-emerald-400 font-bold">{bucket.count}</span>
              <div
                className="w-full bg-emerald-500 hover:bg-emerald-400 rounded-t-md transition-all duration-500"
                style={{ height: `${bucket.count > 0 ? (bucket.count / maxWeeklyCount) * 80 : 4}%` }}
              />
              <span className="text-[9px] text-slate-400 truncate w-full text-center font-mono">{bucket.weekLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
