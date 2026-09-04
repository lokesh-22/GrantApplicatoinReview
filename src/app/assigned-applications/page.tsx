import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AssignedApplicationsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">My Assigned Applications</h1>
        <p className="text-slate-400 mb-6">Welcome, {session.user.name} ({session.user.email})</p>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <p className="text-indigo-400 font-semibold">Role: {session.user.role}</p>
          <p className="text-slate-300 mt-2">Here are the grant applications currently assigned to you for review.</p>
        </div>
      </div>
    </div>
  );
}
