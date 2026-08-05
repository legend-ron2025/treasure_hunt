'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

type LogEntry = {
  id: string;
  type: string;
  timestamp: string;
  summary: string;
  detail: string;
  studentName: string | null;
  studentPhone: string | null;
  performedBy: string;
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  registration:     { label: 'Registration',      color: 'bg-green-900/50 text-green-300 border-green-700',    icon: '📝' },
  dropout:          { label: 'Dropout',           color: 'bg-red-900/50 text-red-300 border-red-700',          icon: '🚪' },
  ban:              { label: 'Ban',               color: 'bg-orange-900/50 text-orange-300 border-orange-700', icon: '🚫' },
  stage_completion: { label: 'Stage Completed',   color: 'bg-blue-900/50 text-blue-300 border-blue-700',       icon: '✅' },
  admin_action:     { label: 'Admin Action',      color: 'bg-purple-900/50 text-purple-300 border-purple-700', icon: '⚙️' },
};

const FILTER_TABS = [
  { key: 'all',              label: 'All Logs' },
  { key: 'registration',     label: 'Registrations' },
  { key: 'stage_completion', label: 'Completions' },
  { key: 'dropout',          label: 'Dropouts' },
  { key: 'ban',              label: 'Bans' },
  { key: 'admin_action',     label: 'Admin Actions' },
];

export default function AuditLog() {
  const router = useRouter();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  async function fetchLogs() {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    // Cache-busting timestamp
    const ts = Date.now();
    const res = await fetch(`/api/admin/audit-log?type=${typeFilter}&sort=${sort}&_t=${ts}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.status === 401) { router.replace('/admin/login'); return; }
    if (res.ok) {
      setEntries(await res.json());
      setLastUpdated(new Date());
    }
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [typeFilter, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 3s for near-real-time updates
  useEffect(() => {
    const id = setInterval(fetchLogs, 3000);
    return () => clearInterval(id);
  }, [typeFilter, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts: Record<string, number> = { all: entries.length };
  for (const e of entries) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  }

  return (
    <AdminLayout
      title="Audit Log"
      headerRight={
        <div className="flex items-center gap-2">
          <p className="text-gray-500 text-xs hidden md:block">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'}
          </p>
          <button
            onClick={() => setSort((s) => (s === 'desc' ? 'asc' : 'desc'))}
            className="bg-gray-800 border border-gray-700 text-gray-400 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
          >
            {sort === 'desc' ? '↓ Newest first' : '↑ Oldest first'}
          </button>
        </div>
      }
    >
      <div className="max-w-5xl space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                typeFilter === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {label}
              <span className="ml-1 opacity-60">
                ({key === 'all' ? entries.length : (counts[key] ?? 0)})
              </span>
            </button>
          ))}
        </div>

        {/* Log entries */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">No log entries yet for this filter.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">By</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const cfg = TYPE_CONFIG[e.type] ?? { label: e.type, color: 'bg-gray-700 text-gray-300 border-gray-600', icon: '•' };
                    return (
                      <tr key={e.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          <p>{new Date(e.timestamp).toLocaleDateString()}</p>
                          <p>{new Date(e.timestamp).toLocaleTimeString()}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border inline-flex items-center gap-1 ${cfg.color}`}>
                            <span>{cfg.icon}</span>
                            <span>{cfg.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white text-sm font-medium">{e.summary}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{e.detail}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {e.performedBy}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
