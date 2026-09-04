'use client';

import { useState, useEffect } from 'react';
import { ReviewerCalibrationItem } from '@/app/api/reports/calibration/route';

export default function ReviewerCalibrationModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [report, setReport] = useState<ReviewerCalibrationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports/calibration')
      .then((res) => res.json())
      .then((data) => {
        if (data.report) setReport(data.report);
      })
      .catch((err) => console.error('Failed to load calibration report:', err))
      .finally(() => setLoading(false));
  }, []);

  const formatDelta = (val: number) => {
    if (val > 0) return <span className="text-emerald-400 font-semibold">+{val.toFixed(2)}</span>;
    if (val < 0) return <span className="text-red-400 font-semibold">{val.toFixed(2)}</span>;
    return <span className="text-slate-400">0.00</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 font-sans">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-5xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
          <div>
            <h3 className="text-xl font-bold text-white">Reviewer Calibration & Bias Report</h3>
            <p className="text-xs text-slate-400">
              Surfacing scoring outliers (reviewers with ≥3 completed reviews) sorted by largest absolute variance from panel averages.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-lg">
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400 text-center py-8">Calculating panel averages and reviewer variance...</p>
        ) : report.length === 0 ? (
          <p className="text-slate-400 text-center py-8">
            No reviewers currently meet the minimum threshold of 3 completed reviews.
          </p>
        ) : (
          <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3">Reviewer</th>
                    <th className="px-4 py-3 text-center">Reviews</th>
                    <th className="px-4 py-3 text-center">Impact (Rev / Panel / Δ)</th>
                    <th className="px-4 py-3 text-center">Feasibility (Rev / Panel / Δ)</th>
                    <th className="px-4 py-3 text-center">Budget (Rev / Panel / Δ)</th>
                    <th className="px-4 py-3 text-center">Max Outlier Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {report.map((item) => (
                    <tr key={item.reviewerId} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{item.reviewerName}</div>
                        <div className="text-[11px] text-slate-400">{item.reviewerEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-medium">{item.completedReviewsCount}</td>
                      <td className="px-4 py-3 text-center font-mono">
                        {item.reviewerAvg.impact} / {item.panelAvg.impact} ({formatDelta(item.delta.impact)})
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {item.reviewerAvg.feasibility} / {item.panelAvg.feasibility} ({formatDelta(item.delta.feasibility)})
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {item.reviewerAvg.budget} / {item.panelAvg.budget} ({formatDelta(item.delta.budget)})
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          item.maxAbsoluteDelta >= 1.0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          item.maxAbsoluteDelta >= 0.5 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          ±{item.maxAbsoluteDelta}
                        </span>
                      </td>
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
