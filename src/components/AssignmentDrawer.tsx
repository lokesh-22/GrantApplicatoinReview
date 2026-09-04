'use client';

import { useState, useEffect } from 'react';

interface Assignment {
  id: string;
  dueDate: string;
  removedAt: string | null;
  reviewer: { id: string; name: string; email: string };
  reviews: { id: string; status: string; completedAt: string | null }[];
}

interface Reviewer {
  id: string;
  name: string;
  email: string;
}

export default function AssignmentDrawer({
  applicationId,
  orgName,
  onClose,
}: {
  applicationId: string;
  orgName: string;
  onClose: () => void;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editing Due Date state
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editDueDate, setEditDueDate] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [asgnRes, revRes] = await Promise.all([
        fetch(`/api/applications/${applicationId}/assign`),
        fetch('/api/users/reviewers'),
      ]);

      const asgnData = await asgnRes.json();
      const revData = await revRes.json();

      if (asgnData.assignments) setAssignments(asgnData.assignments);
      if (revData.reviewers) setReviewers(revData.reviewers);
    } catch (err) {
      console.error('Failed to load assignment data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Default due date: 14 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14);
    setDueDate(defaultDate.toISOString().split('T')[0]);
  }, [applicationId]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedReviewerId || !dueDate) {
      setError('Please select a reviewer and a due date.');
      return;
    }

    try {
      const res = await fetch(`/api/applications/${applicationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId: selectedReviewerId, dueDate }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to assign reviewer.');
        return;
      }

      setSelectedReviewerId('');
      fetchData();
    } catch (err) {
      setError('An error occurred.');
    }
  };

  const handleRemove = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this reviewer assignment?')) return;
    setError('');

    try {
      const res = await fetch(`/api/applications/${applicationId}/assign?assignmentId=${assignmentId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to remove assignment.');
        return;
      }

      fetchData();
    } catch (err) {
      setError('An error occurred.');
    }
  };

  const handleUpdateDueDate = async (assignmentId: string) => {
    setError('');

    try {
      const res = await fetch(`/api/applications/${applicationId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, dueDate: editDueDate }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update due date.');
        return;
      }

      setEditingAssignmentId(null);
      fetchData();
    } catch (err) {
      setError('An error occurred.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <div className="bg-slate-800 border-l border-slate-700 w-full max-w-md h-full p-6 shadow-2xl overflow-y-auto flex flex-col justify-between space-y-6">
        <div>
          <div className="flex justify-between items-center border-b border-slate-700 pb-4 mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">Reviewer Assignments</h3>
              <p className="text-xs text-slate-400">{orgName}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white font-bold">
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* New Assignment Form */}
          <form onSubmit={handleAssign} className="bg-slate-900/60 p-4 rounded-xl border border-slate-700 space-y-3 mb-6">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Assign New Reviewer</h4>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Reviewer</label>
              <select
                value={selectedReviewerId}
                onChange={(e) => setSelectedReviewerId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
              >
                <option value="">Select Reviewer...</option>
                {reviewers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Due Date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium cursor-pointer"
            >
              + Assign Reviewer
            </button>
          </form>

          {/* Current Assignments List */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Assigned Reviewers</h4>
            {loading ? (
              <p className="text-xs text-slate-400">Loading assignments...</p>
            ) : assignments.length === 0 ? (
              <p className="text-xs text-slate-400">No reviewers currently assigned.</p>
            ) : (
              <div className="space-y-3">
                {assignments.map((asgn) => {
                  const isCompleted = asgn.reviews.some((r) => r.status === 'COMPLETED');
                  const isRemoved = Boolean(asgn.removedAt);

                  return (
                    <div
                      key={asgn.id}
                      className={`p-3 rounded-lg border text-xs space-y-2 ${
                        isRemoved
                          ? 'bg-slate-900/30 border-slate-800 opacity-60'
                          : 'bg-slate-900/80 border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-white">{asgn.reviewer.name}</p>
                          <p className="text-slate-400 text-[11px]">{asgn.reviewer.email}</p>
                        </div>
                        {isRemoved ? (
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">Removed</span>
                        ) : isCompleted ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px]">Completed</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[10px]">Active</span>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <div>
                          Due: {new Date(asgn.dueDate).toLocaleDateString()}
                        </div>

                        {!isRemoved && !isCompleted && (
                          <div className="space-x-2">
                            <button
                              onClick={() => {
                                setEditingAssignmentId(asgn.id);
                                setEditDueDate(new Date(asgn.dueDate).toISOString().split('T')[0]);
                              }}
                              className="text-indigo-400 hover:underline"
                            >
                              Edit Due Date
                            </button>
                            <button
                              onClick={() => handleRemove(asgn.id)}
                              className="text-red-400 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Due date editing form inline */}
                      {editingAssignmentId === asgn.id && (
                        <div className="flex gap-2 pt-2 border-t border-slate-800">
                          <input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-[11px]"
                          />
                          <button
                            onClick={() => handleUpdateDueDate(asgn.id)}
                            className="px-2 py-1 bg-indigo-600 text-white rounded text-[11px]"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingAssignmentId(null)}
                            className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-[11px]"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium cursor-pointer"
        >
          Close Panel
        </button>
      </div>
    </div>
  );
}
