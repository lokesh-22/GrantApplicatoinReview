'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface TimelineEventItem {
  id: string;
  type: 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'ASSIGNMENT_REMOVED' | 'COMMENT';
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export default function ApplicationTimelineModal({
  applicationId,
  orgName,
  onClose,
}: {
  applicationId: string;
  orgName: string;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const [events, setEvents] = useState<TimelineEventItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/timeline`);
      const data = await res.json();
      if (data.timelineEvents) {
        setEvents(data.timelineEvents);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [applicationId]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/applications/${applicationId}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newComment }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to post comment.');
        setSubmitting(false);
        return;
      }

      setNewComment('');
      fetchTimeline();
    } catch (err) {
      setError('An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'CREATED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'STATUS_CHANGED':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'ASSIGNED':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'ASSIGNMENT_REMOVED':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'COMMENT':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 font-sans">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center border-b border-slate-700 pb-4 mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">Application Audit Timeline</h3>
              <p className="text-xs text-slate-400">{orgName}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-lg">
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Chronological Activity Feed */}
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
            {loading ? (
              <p className="text-xs text-slate-400 text-center py-4">Loading application history...</p>
            ) : events.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No events logged yet.</p>
            ) : (
              events.map((evt) => (
                <div key={evt.id} className="relative pl-6 border-l-2 border-slate-700 space-y-1">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-indigo-500" />
                  
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getEventBadgeClass(evt.type)}`}>
                        {evt.type}
                      </span>
                      <span className="text-xs font-semibold text-white">{evt.actor.name}</span>
                      <span className="text-[10px] text-slate-500">({evt.actor.role})</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(evt.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {evt.type === 'STATUS_CHANGED' && (
                    <p className="text-xs text-purple-300 font-mono">
                      Status changed: <span className="line-through text-slate-400">{evt.oldValue}</span> → <span className="font-bold">{evt.newValue}</span>
                    </p>
                  )}

                  {evt.type === 'ASSIGNED' && (
                    <p className="text-xs text-indigo-300">
                      Assigned reviewer: <span className="font-semibold text-white">{evt.newValue}</span>
                    </p>
                  )}

                  {evt.type === 'ASSIGNMENT_REMOVED' && (
                    <p className="text-xs text-red-300">
                      Removed reviewer: <span className="font-semibold text-white">{evt.oldValue}</span>
                    </p>
                  )}

                  {evt.note && (
                    <p className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-700/50 mt-1 italic">
                      "{evt.note}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leave a Comment Action */}
        <form onSubmit={handlePostComment} className="pt-4 border-t border-slate-700 space-y-3">
          <label className="block text-xs font-semibold text-white uppercase tracking-wider">Leave a Comment</label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Write a comment or note to record in timeline..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
