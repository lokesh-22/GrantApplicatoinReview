'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface Assignment {
  id: string;
  dueDate: string;
  application: {
    id: string;
    orgName: string;
    contactEmail: string;
    fundingRound: string;
    amountRequested: string;
    submissionDate: string;
    status: string;
    owner: { name: string; email: string };
    reviews: {
      id: string;
      impactScore: number | null;
      feasibilityScore: number | null;
      budgetScore: number | null;
      comments: string | null;
      status: 'DRAFT' | 'COMPLETED';
    }[];
    conflicts: { id: string; reason: string }[];
  };
}

interface Review {
  id: string;
  impactScore: number | null;
  feasibilityScore: number | null;
  budgetScore: number | null;
  comments: string | null;
  status: 'DRAFT' | 'COMPLETED';
  completedAt: string | null;
  reviewer: { id: string; name: string; email: string };
}

export default function ReviewerPortal() {
  const { data: session } = useSession();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Modal State
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [impactScore, setImpactScore] = useState<number | ''>('');
  const [feasibilityScore, setFeasibilityScore] = useState<number | ''>('');
  const [budgetScore, setBudgetScore] = useState<number | ''>('');
  const [comments, setComments] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [saving, setSaving] = useState(false);

  // Conflict Modal State
  const [conflictAssignment, setConflictAssignment] = useState<Assignment | null>(null);
  const [conflictReason, setConflictReason] = useState('');
  const [conflictError, setConflictError] = useState('');

  // App Detail & Reviews View Modal
  const [detailAppId, setDetailAppId] = useState<string | null>(null);
  const [detailReviews, setDetailReviews] = useState<Review[]>([]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reviewer/assignments');
      const data = await res.json();
      if (data.assignments) {
        setAssignments(data.assignments);
      }
    } catch (err) {
      console.error('Failed to fetch reviewer assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const openReviewModal = (assignment: Assignment) => {
    const existingReview = assignment.application.reviews[0];
    setActiveAssignment(assignment);
    setImpactScore(existingReview?.impactScore || '');
    setFeasibilityScore(existingReview?.feasibilityScore || '');
    setBudgetScore(existingReview?.budgetScore || '');
    setComments(existingReview?.comments || '');
    setReviewError('');
  };

  const handleSaveReview = async (status: 'DRAFT' | 'COMPLETED') => {
    if (!activeAssignment) return;
    setReviewError('');
    setSaving(true);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: activeAssignment.application.id,
          assignmentId: activeAssignment.id,
          impactScore: impactScore !== '' ? Number(impactScore) : null,
          feasibilityScore: feasibilityScore !== '' ? Number(feasibilityScore) : null,
          budgetScore: budgetScore !== '' ? Number(budgetScore) : null,
          comments,
          status,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setReviewError(data.error || 'Failed to submit review.');
        setSaving(false);
        return;
      }

      setActiveAssignment(null);
      fetchAssignments();
    } catch (err) {
      setReviewError('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeclareConflict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conflictAssignment) return;
    setConflictError('');

    try {
      const res = await fetch('/api/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: conflictAssignment.application.id,
          reason: conflictReason,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setConflictError(data.error || 'Failed to declare conflict.');
        return;
      }

      setConflictAssignment(null);
      setConflictReason('');
      fetchAssignments();
    } catch (err) {
      setConflictError('An error occurred.');
    }
  };

  const viewApplicationDetails = async (appId: string) => {
    setDetailAppId(appId);
    try {
      const res = await fetch(`/api/applications/${appId}/reviews`);
      const data = await res.json();
      if (data.reviews) {
        setDetailReviews(data.reviews);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <h2 className="text-xl font-bold text-white">Assigned Applications</h2>
        <p className="text-slate-400 text-sm">Review grant proposals assigned to you, save drafts, or submit final evaluation scores.</p>
      </div>

      {loading ? (
        <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center text-slate-400">
          Loading assigned applications...
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center text-slate-400">
          You currently have no active application assignments.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assignments.map((asgn) => {
            const app = asgn.application;
            const existingReview = app.reviews[0];
            const hasConflict = app.conflicts.length > 0;
            const isCompleted = existingReview?.status === 'COMPLETED';

            return (
              <div key={asgn.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-white">{app.orgName}</h3>
                    {isCompleted ? (
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-full">
                        Review Completed
                      </span>
                    ) : existingReview ? (
                      <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full">
                        Draft Saved
                      </span>
                    ) : hasConflict ? (
                      <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold rounded-full">
                        Conflict Declared
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold rounded-full">
                        Pending Review
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{app.fundingRound}</p>

                  <div className="mt-4 space-y-1 text-sm text-slate-300">
                    <p><span className="text-slate-500">Amount Requested:</span> ${Number(app.amountRequested).toLocaleString()}</p>
                    <p><span className="text-slate-500">Contact:</span> {app.contactEmail}</p>
                    <p><span className="text-slate-500">Due Date:</span> {new Date(asgn.dueDate).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => viewApplicationDetails(app.id)}
                    className="text-xs text-indigo-400 hover:underline cursor-pointer"
                  >
                    View All Reviews
                  </button>

                  <div className="flex gap-2">
                    {!hasConflict && (
                      <button
                        onClick={() => openReviewModal(asgn)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          isCompleted
                            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500'
                        }`}
                      >
                        {isCompleted ? 'View Review' : existingReview ? 'Continue Review' : 'Start Review'}
                      </button>
                    )}

                    {!hasConflict && !isCompleted && (
                      <button
                        onClick={() => {
                          setConflictAssignment(asgn);
                          setConflictReason('');
                          setConflictError('');
                        }}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        Declare COI
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {activeAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-700 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">Evaluate Proposal</h3>
                <p className="text-xs text-slate-400">{activeAssignment.application.orgName}</p>
              </div>
              {activeAssignment.application.reviews[0]?.status === 'COMPLETED' && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-semibold border border-emerald-500/30">
                  COMPLETED (Read-Only)
                </span>
              )}
            </div>

            {reviewError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg">
                {reviewError}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Impact (1-5)</label>
                  <select
                    disabled={activeAssignment.application.reviews[0]?.status === 'COMPLETED'}
                    value={impactScore}
                    onChange={(e) => setImpactScore(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Feasibility (1-5)</label>
                  <select
                    disabled={activeAssignment.application.reviews[0]?.status === 'COMPLETED'}
                    value={feasibilityScore}
                    onChange={(e) => setFeasibilityScore(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Budget (1-5)</label>
                  <select
                    disabled={activeAssignment.application.reviews[0]?.status === 'COMPLETED'}
                    value={budgetScore}
                    onChange={(e) => setBudgetScore(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Comments / Justification</label>
                <textarea
                  rows={4}
                  disabled={activeAssignment.application.reviews[0]?.status === 'COMPLETED'}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Provide feedback on the methodology, team capabilities, and requested budget..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setActiveAssignment(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg cursor-pointer"
              >
                Close
              </button>

              {activeAssignment.application.reviews[0]?.status !== 'COMPLETED' && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveReview('DRAFT')}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-amber-400 text-sm font-medium rounded-lg border border-amber-500/20 cursor-pointer"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveReview('COMPLETED')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg cursor-pointer"
                  >
                    Submit Review
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Declare COI Modal */}
      {conflictAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-white">Declare Conflict of Interest</h3>
            <p className="text-xs text-slate-400">
              Declaring a conflict for <span className="text-white font-semibold">{conflictAssignment.application.orgName}</span> will flag this assignment for Program Officers.
            </p>

            {conflictError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg">
                {conflictError}
              </div>
            )}

            <form onSubmit={handleDeclareConflict} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Reason for Conflict</label>
                <textarea
                  required
                  rows={3}
                  value={conflictReason}
                  onChange={(e) => setConflictReason(e.target.value)}
                  placeholder="e.g. Current collaborator, financial interest, advisory board member..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConflictAssignment(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg cursor-pointer"
                >
                  Confirm COI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application Reviews View Modal */}
      {detailAppId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-700 pb-4">
              <h3 className="text-xl font-bold text-white">Application Reviews & Feedback</h3>
              <button
                onClick={() => setDetailAppId(null)}
                className="text-slate-400 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {detailReviews.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No visible reviews submitted yet.</p>
            ) : (
              <div className="space-y-4">
                {detailReviews.map((rev) => (
                  <div key={rev.id} className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/80 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-semibold text-white">{rev.reviewer.name}</span>
                        <span className="text-xs text-slate-400 ml-2">({rev.reviewer.email})</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${
                        rev.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {rev.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-800/80 p-2.5 rounded-lg text-xs text-center font-mono">
                      <div><span className="text-slate-400">Impact:</span> <span className="text-indigo-400 font-bold">{rev.impactScore ?? 'N/A'}</span></div>
                      <div><span className="text-slate-400">Feasibility:</span> <span className="text-indigo-400 font-bold">{rev.feasibilityScore ?? 'N/A'}</span></div>
                      <div><span className="text-slate-400">Budget:</span> <span className="text-indigo-400 font-bold">{rev.budgetScore ?? 'N/A'}</span></div>
                    </div>

                    <p className="text-slate-300 text-sm italic">{rev.comments || 'No comments recorded.'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
