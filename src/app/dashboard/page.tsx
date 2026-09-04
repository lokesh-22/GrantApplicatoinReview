import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ApplicationsManager from '@/components/ApplicationsManager';
import DashboardMetrics from '@/components/DashboardMetrics';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (session.user.role === 'REVIEWER') {
    redirect('/assigned-applications');
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-slate-800 p-6 rounded-xl border border-slate-700">
          <div>
            <h1 className="text-2xl font-bold">Program Officer Dashboard</h1>
            <p className="text-slate-400 text-sm">Logged in as {session.user.name} ({session.user.email})</p>
          </div>
        </div>

        <DashboardMetrics />
        <ApplicationsManager />
      </div>
    </div>
  );
}
