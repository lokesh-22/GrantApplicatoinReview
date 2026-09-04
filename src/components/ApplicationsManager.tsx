'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

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
  owner: {
    id: string;
    name: string;
    email: string;
  };
}

interface ProgramOfficer {
  id: string;
  name: string;
  email: string;
}

export default function ApplicationsManager() {
  const { data: session } = useSession();
  const [applications, setApplications] = useState<Application[]>([]);
  const [programOfficers, setProgramOfficers] = useState<ProgramOfficer[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);

  // Form states
  const [orgName, setOrgName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [fundingRound, setFundingRound] = useState('FY2024-Q1 Tech Innovation');
  const [amountRequested, setAmountRequested] = useState('');
  const [submissionDate, setSubmissionDate] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [error, setError] = useState('');

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/applications?includeArchived=${includeArchived}`);
      const data = await res.json();
      if (data.applications) {
        setApplications(data.applications);
      }
    } catch (err) {
      console.error('Failed to fetch applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgramOfficers = async () => {
    try {
      const res = await fetch('/api/users/program-officers');
      const data = await res.json();
      if (data.programOfficers) {
        setProgramOfficers(data.programOfficers);
      }
    } catch (err) {
      console.error('Failed to fetch program officers:', err);
    }
  };

  useEffect(() => {
    fetchApplications();
    fetchProgramOfficers();
  }, [includeArchived]);

  const openCreateModal = () => {
    setEditingApp(null);
    setOrgName('');
    setContactEmail('');
    setFundingRound('FY2024-Q1 Tech Innovation');
    setAmountRequested('');
    setSubmissionDate(new Date().toISOString().split('T')[0]);
    setOwnerId(session?.user?.id || '');
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (app: Application) => {
    setEditingApp(app);
    setOrgName(app.orgName);
    setContactEmail(app.contactEmail);
    setFundingRound(app.fundingRound);
    setAmountRequested(app.amountRequested);
    setSubmissionDate(new Date(app.submissionDate).toISOString().split('T')[0]);
    setOwnerId(app.ownerId);
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const payload = {
      orgName,
      contactEmail,
      fundingRound,
      amountRequested,
      submissionDate,
      ownerId,
    };

    try {
      const url = editingApp ? `/api/applications/${editingApp.id}` : '/api/applications';
      const method = editingApp ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Operation failed');
        return;
      }

      setModalOpen(false);
      fetchApplications();
    } catch (err) {
      setError('An error occurred');
    }
  };

  const toggleArchive = async (app: Application) => {
    try {
      const res = await fetch(`/api/applications/${app.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !app.archived }),
      });

      if (res.ok) {
        fetchApplications();
      }
    } catch (err) {
      console.error('Failed to toggle archive state:', err);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <div>
          <h2 className="text-xl font-bold text-white">Application Directory</h2>
          <p className="text-slate-400 text-sm">Manage, edit, archive, and track grant applications</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            Include Archived
          </label>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors shadow-sm cursor-pointer"
          >
            + Create Application
          </button>
        </div>
      </div>

      {/* Applications Simple Table List */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading applications...</div>
        ) : applications.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No applications found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4">Organization</th>
                  <th className="px-6 py-4">Funding Round</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Owner (PO)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {applications.map((app) => (
                  <tr key={app.id} className={app.archived ? 'opacity-50 bg-slate-900/30' : 'hover:bg-slate-700/30 transition-colors'}>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{app.orgName}</div>
                      <div className="text-xs text-slate-400">{app.contactEmail}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-300">{app.fundingRound}</td>
                    <td className="px-6 py-4 font-mono text-emerald-400 font-medium">
                      ${Number(app.amountRequested).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{app.owner?.name || 'Unassigned'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        app.status === 'SUBMITTED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        app.status === 'ASSIGNED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        app.status === 'UNDER_REVIEW' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {app.status}
                      </span>
                      {app.archived && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(app)}
                        className="text-xs font-medium text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleArchive(app)}
                        className={`text-xs font-medium px-2.5 py-1 rounded border transition-colors ${
                          app.archived
                            ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20'
                            : 'text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20'
                        }`}
                      >
                        {app.archived ? 'Restore' : 'Archive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Create/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-white">
              {editingApp ? 'Edit Application' : 'Create Application'}
            </h3>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contact Email</label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Funding Round</label>
                <select
                  value={fundingRound}
                  onChange={(e) => setFundingRound(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="FY2024-Q1 Tech Innovation">FY2024-Q1 Tech Innovation</option>
                  <option value="FY2024-Q2 Health & Bio">FY2024-Q2 Health & Bio</option>
                  <option value="FY2024-Q3 Climate Resilience">FY2024-Q3 Climate Resilience</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Amount Requested ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amountRequested}
                    onChange={(e) => setAmountRequested(e.target.value)}
                    placeholder="50000.00"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Submission Date</label>
                  <input
                    type="date"
                    required
                    value={submissionDate}
                    onChange={(e) => setSubmissionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Owner (Program Officer)</label>
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {programOfficers.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.name} ({po.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                >
                  {editingApp ? 'Save Changes' : 'Create Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
