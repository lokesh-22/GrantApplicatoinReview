'use client';

import { useState, useEffect } from 'react';
import { BulkAssignmentReportItem } from '@/app/api/applications/bulk-assign/route';

interface Reviewer {
  id: string;
  name: string;
  email: string;
}

export default function BulkAssignAndExportModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [fundingRound, setFundingRound] = useState('FY2024-Q1 Tech Innovation');
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<BulkAssignmentReportItem[] | null>(null);

  useEffect(() => {
    // Fetch available reviewers
    fetch('/api/users/reviewers')
      .then((res) => res.json())
      .then((data) => {
        if (data.reviewers) setReviewers(data.reviewers);
      });

    // Default due date: 14 days from today
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDueDate(d.toISOString().split('T')[0]);
  }, []);

  const toggleReviewer = (id: string) => {
    setSelectedReviewerIds((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]
    );
  };

  const handleBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReviewerIds.length === 0) {
      setError('Please select at least one reviewer.');
      return;
    }

    setLoading(true);
    setError('');
    setReport(null);

    try {
      const res = await fetch('/api/applications/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fundingRound,
          reviewerIds: selectedReviewerIds,
          dueDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Bulk assignment failed.');
        setLoading(false);
        return;
      }

      setReport(data.report);
    } catch (err) {
      setError('An error occurred during bulk assignment.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    window.location.href = `/api/reviews/export-csv?fundingRound=${encodeURIComponent(fundingRound)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 font-sans">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Bulk Assign & CSV Export</h3>
            <p className="text-xs text-slate-400">Batch assign reviewers to all applications in a round or export completed reviews</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-lg">
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Export CSV Section */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h4 className="text-sm font-semibold text-white">Export Completed Reviews CSV</h4>
            <p className="text-xs text-slate-400">Download CSV report with separate columns for Impact, Feasibility, and Budget scores.</p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-colors cursor-pointer"
          >
            📥 Export CSV
          </button>
        </div>

        {/* Bulk Assignment Form */}
        <form onSubmit={handleBulkAssign} className="space-y-4">
          <h4 className="text-sm font-semibold text-white uppercase tracking-wider text-xs border-b border-slate-700 pb-2">
            Batch Assign Reviewers
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Funding Round</label>
              <select
                value={fundingRound}
                onChange={(e) => setFundingRound(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
              >
                <option value="FY2024-Q1 Tech Innovation">FY2024-Q1 Tech Innovation</option>
                <option value="FY2024-Q2 Health & Bio">FY2024-Q2 Health & Bio</option>
                <option value="FY2024-Q3 Climate Resilience">FY2024-Q3 Climate Resilience</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Assignment Due Date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Select Reviewers to Assign</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-700 max-h-48 overflow-y-auto">
              {reviewers.map((r) => {
                const isSelected = selectedReviewerIds.includes(r.id);
                return (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => toggleReviewer(r.id)}
                    className={`p-2 rounded-lg text-left text-xs border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 font-semibold'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div>{r.name}</div>
                    <div className="text-[10px] opacity-75 truncate">{r.email}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow cursor-pointer"
            >
              {loading ? 'Processing Assignments...' : 'Execute Bulk Assignment'}
            </button>
          </div>
        </form>

        {/* Results Report Table */}
        {report && (
          <div className="space-y-3 pt-4 border-t border-slate-700">
            <h4 className="text-sm font-semibold text-white">Bulk Assignment Report</h4>
            <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800 text-slate-400 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Application</th>
                    <th className="px-4 py-2.5">Reviewer</th>
                    <th className="px-4 py-2.5">Result</th>
                    <th className="px-4 py-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {report.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="px-4 py-2 font-medium text-white">{item.orgName}</td>
                      <td className="px-4 py-2">{item.reviewerName}</td>
                      <td className="px-4 py-2">
                        {item.result === 'succeeded' ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-semibold text-[10px]">
                            succeeded
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-semibold text-[10px]">
                            refused
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-400 capitalize">{item.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
