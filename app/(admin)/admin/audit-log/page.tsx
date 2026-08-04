'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type AuditEntry = { id: string; participantName: string; participantPhone: string; stageAtDeletion: number; action: string; performedBy: string; performedAt: string; extraInfo: string | null; };

export default function AuditLog() {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    fetch('/api/admin/audit-log', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : []).then(setEntries);
  }, []);

  const sorted = [...entries].sort((a, b) => {
    const diff = new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime();
    return sort === 'asc' ? diff : -diff;
  });

  const actionLabel: Record<string, string> = { delete_student: '🗑 Delete', reset_progress: '↺ Reset', event_reset: '⚠ Event Reset' };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-800 text-white px-4 py-3 flex gap-4 text-sm">
        <a href="/admin/dashboard" className="hover:text-blue-300">Dashboard</a>
        <a href="/admin/audit-log" className="text-blue-300">Audit Log</a>
      </nav>
      <main className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Audit Log</h1>
          <button onClick={() => setSort((s) => s === 'asc' ? 'desc' : 'asc')} className="text-sm bg-white border px-3 py-1.5 rounded hover:bg-gray-50">
            Sort: {sort === 'desc' ? 'Newest first' : 'Oldest first'}
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Timestamp', 'Student', 'Phone', 'Stage', 'Action', 'Performed By'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400 text-xs">{new Date(e.performedAt).toLocaleString()}</td>
                  <td className="px-3 py-2 font-medium">{e.participantName}</td>
                  <td className="px-3 py-2 text-gray-500">{e.participantPhone}</td>
                  <td className="px-3 py-2">{e.stageAtDeletion}</td>
                  <td className="px-3 py-2">{actionLabel[e.action] ?? e.action}</td>
                  <td className="px-3 py-2 text-gray-500">{e.performedBy}</td>
                </tr>
              ))}
              {sorted.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-400">No audit entries.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
