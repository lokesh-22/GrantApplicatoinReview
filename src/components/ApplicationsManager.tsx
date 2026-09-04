'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import ApplicationsTable from '@/components/ApplicationsTable';
import BulkAssignAndExportModal from '@/components/BulkAssignAndExportModal';
import ReviewerCalibrationModal from '@/components/ReviewerCalibrationModal';

interface ProgramOfficer {
  id: string;
  name: string;
  email: string;
}

export default function ApplicationsManager() {
  const { data: session } = useSession();
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [calibrationModalOpen, setCalibrationModalOpen] = useState(false);

  // Form states
  const [orgName, setOrgName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [fundingRound, setFundingRound] = useState('FY2024-Q1 Tech Innovation');
  const [amountRequested, setAmountRequested] = useState('');
  const [submissionDate, setSubmissionDate] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [error, setError] = useState('');
  const [programOfficers, setProgramOfficers] = useState<ProgramOfficer[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchProgramOfficers = async () => {
    try {
      const res = await fetch('/api/users/program-officers');
      const data = await res.json();
      if (data.programOfficers) setProgramOfficers(data.programOfficers);
    } catch (err) {}
  };

  useEffect(() => {
    fetchProgramOfficers();
  }, []);

  const openCreateModal = () => {
    setOrgName('');
    setContactEmail('');
    setFundingRound('FY2024-Q1 Tech Innovation');
    setAmountRequested('');
    setSubmissionDate(new Date().toISOString().split('T')[0]);
    setOwnerId(session?.user?.id || '');
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName,
          contactEmail,
          fundingRound,
          amountRequested,
          submissionDate,
          ownerId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Creation failed');
        return;
      }

      setModalOpen(false);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      setError('An error occurred');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <div>
          <h2 className="text-xl font-bold text-white">Application Directory</h2>
          <p className="text-slate-400 text-sm">Filter, search, sort, and manage grant applications</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setCalibrationModalOpen(true)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium text-sm transition-colors shadow-sm cursor-pointer border border-slate-600"
          >
            📊 Calibration Report
          </button>
          <button
            onClick={() => setBulkModalOpen(true)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium text-sm transition-colors shadow-sm cursor-pointer border border-slate-600"
          >
            ⚡ Bulk Assign & Export
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors shadow-sm cursor-pointer"
          >
            + Create Application
          </button>
        </div>
      </div>

      <ApplicationsTable key={refreshKey} />

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-white">Create Application</h3>

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
                  Create Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {calibrationModalOpen && (
        <ReviewerCalibrationModal
          onClose={() => setCalibrationModalOpen(false)}
        />
      )}
      {bulkModalOpen && (
        <BulkAssignAndExportModal
          onClose={() => {
            setBulkModalOpen(false);
            setRefreshKey((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}
