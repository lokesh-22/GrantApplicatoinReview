'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface ProgressData {
  poolSet: boolean;
  fundingRound: string;
  totalPool?: number;
  allocatedAmount?: number;
  percentageUsed?: number;
}

export default function FundingPoolProgressBar({
  fundingRound,
}: {
  fundingRound: string;
}) {
  const { data: session } = useSession();
  const [data, setData] = useState<ProgressData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [inputPool, setInputPool] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProgress = async () => {
    if (!fundingRound) {
      setData(null);
      return;
    }

    try {
      const res = await fetch(`/api/funding-rounds/budget-progress?fundingRound=${encodeURIComponent(fundingRound)}`);
      const resData = await res.json();
      setData(resData);
    } catch (err) {
      console.error('Failed to fetch budget progress:', err);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [fundingRound]);

  const handleSetPool = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/funding-rounds/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundName: fundingRound,
          totalPool: inputPool,
        }),
      });

      if (res.ok) {
        setModalOpen(false);
        fetchProgress();
      }
    } catch (err) {
      console.error('Failed to save pool:', err);
    } finally {
      setSaving(false);
    }
  };

  // If no round selected, return null
  if (!fundingRound) return null;

  // If pool is NOT set, do not render a broken 0/0 progress bar. Show a small button for POs to set pool if desired.
  if (!data || !data.poolSet) {
    if (session?.user?.role === 'PROGRAM_OFFICER') {
      return (
        <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl flex justify-between items-center text-xs">
          <span className="text-slate-400">No funding pool configured for <span className="text-slate-200 font-semibold">{fundingRound}</span></span>
          <button
            onClick={() => { setInputPool(''); setModalOpen(true); }}
            className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-indigo-300 rounded border border-indigo-500/30 cursor-pointer"
          >
            + Set Pool Budget
          </button>

          {modalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-white">Set Pool Budget</h3>
                <p className="text-xs text-slate-400">Specify total available pool budget for {fundingRound}</p>
                <form onSubmit={handleSetPool} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Total Pool ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={inputPool}
                      onChange={(e) => setInputPool(e.target.value)}
                      placeholder="1000000.00"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-xs">Cancel</button>
                    <button type="submit" disabled={saving} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs">Save Pool</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null; // Hide completely for non-POs when pool is not set
  }

  // Render progress bar when totalPool IS set
  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2 font-sans shadow-md">
      <div className="flex justify-between items-center text-xs">
        <div>
          <span className="font-bold text-white">{fundingRound} Budget Pool</span>
          <span className="text-slate-400 ml-2">
            (${Number(data.allocatedAmount).toLocaleString()} allocated of ${Number(data.totalPool).toLocaleString()})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-indigo-400">{data.percentageUsed}% Decided</span>
          {session?.user?.role === 'PROGRAM_OFFICER' && (
            <button
              onClick={() => { setInputPool(String(data.totalPool)); setModalOpen(true); }}
              className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
            >
              Edit Pool
            </button>
          )}
        </div>
      </div>

      <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            (data.percentageUsed || 0) >= 90 ? 'bg-red-500' :
            (data.percentageUsed || 0) >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(100, data.percentageUsed || 0)}%` }}
        />
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Edit Pool Budget</h3>
            <p className="text-xs text-slate-400">Update total available pool budget for {fundingRound}</p>
            <form onSubmit={handleSetPool} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Total Pool ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={inputPool}
                  onChange={(e) => setInputPool(e.target.value)}
                  placeholder="1000000.00"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded text-xs">Cancel</button>
                <button type="submit" disabled={saving} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs">Save Pool</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
