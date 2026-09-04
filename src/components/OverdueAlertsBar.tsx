'use client';

import { useState, useEffect } from 'react';

interface OverdueAlert {
  id: string;
  dueDate: string;
  application: { id: string; orgName: string; fundingRound: string };
  reviewer: { id: string; name: string; email: string };
}

export default function OverdueAlertsBar({
  onSelectApplication,
}: {
  onSelectApplication?: (appId: string) => void;
}) {
  const [alerts, setAlerts] = useState<OverdueAlert[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts/overdue');
      const data = await res.json();
      if (data.alerts) {
        setAlerts(data.alerts);
        setCount(data.count);
      }
    } catch (err) {
      console.error('Failed to load overdue alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Auto refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = async (assignmentId: string) => {
    setDismissingId(assignmentId);
    try {
      const res = await fetch('/api/alerts/overdue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      });

      if (res.ok) {
        fetchAlerts();
      }
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    } finally {
      setDismissingId(null);
    }
  };

  if (loading || count === 0) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3 font-sans">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
          <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
            Overdue Review Alerts ({count})
          </h3>
        </div>
        <span className="text-xs text-amber-300 font-medium">Requires Program Officer Attention</span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {alerts.map((alt) => (
          <div
            key={alt.id}
            className="flex items-center justify-between bg-slate-900/80 p-3 rounded-lg border border-amber-500/20 text-xs"
          >
            <div className="space-y-0.5">
              <p className="font-semibold text-white">
                {alt.application.orgName} <span className="text-slate-400 font-normal">({alt.application.fundingRound})</span>
              </p>
              <p className="text-amber-300">
                Assigned to: <span className="font-medium text-white">{alt.reviewer.name}</span> | Due: <span className="font-mono">{new Date(alt.dueDate).toLocaleDateString()}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={dismissingId === alt.id}
                onClick={() => handleDismiss(alt.id)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs font-medium cursor-pointer"
              >
                Dismiss Alert
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
