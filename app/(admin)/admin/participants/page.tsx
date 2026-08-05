'use client';
import { useCallback, useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

type Participant = {
  id: string;
  name: string;
  phone: string;
  status: string;
  currentStage: number;
  registeredAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-900/60 text-green-300',
  completed: 'bg-yellow-900/60 text-yellow-300',
  cancelled: 'bg-gray-800 text-gray-500',
};

export default function ParticipantList() {
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Participant | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [reregisterTarget, setReregisterTarget] = useState<Participant | null>(null);
  const [reregisterName, setReregisterName] = useState('');
  const [reregisterPhone, setReregisterPhone] = useState('');
  const [reregisterError, setReregisterError] = useState('');
  const [reregisterSuccess, setReregisterSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    const res = await fetch(`/api/admin/participants?_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.status === 401) { router.replace('/admin/login'); return; }
    if (res.ok) { setParticipants(await res.json()); setLastUpdated(new Date()); }
  }, [router]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  async function doReregister(e: FormEvent) {
    e.preventDefault();
    if (!reregisterTarget) return;
    setReregisterError('');
    setReregisterSuccess('');
    setLoading(true);
    const token = getToken();
    const res = await fetch(`/api/admin/participants/${reregisterTarget.id}/reregister`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: reregisterName.trim(), phone: reregisterPhone.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setReregisterError(data.error ?? 'Re-registration failed.');
    } else {
      setReregisterSuccess(`✅ ${data.message}`);
      setTimeout(() => {
        setReregisterTarget(null);
        setReregisterName('');
        setReregisterPhone('');
        setReregisterSuccess('');
        load();
      }, 2000);
    }
  }

  async function doDelete(id: string) {
    setLoading(true);
    const token = getToken();
    await fetch(`/api/admin/participants/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ confirm: true }),
    });
    setConfirmDelete(null);
    setLoading(false);
    load();
  }

  async function doReset(id: string) {
    const token = getToken();
    await fetch(`/api/admin/participants/${id}/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  async function doBulkDelete() {
    if (selected.size === 0) return;
    setLoading(true);
    const token = getToken();
    await fetch('/api/admin/participants', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: Array.from(selected), confirm: true }),
    });
    setSelected(new Set());
    setConfirmBulk(false);
    setLoading(false);
    load();
  }

  const filtered = participants.filter((p) => {
    const matchStatus = !statusFilter || p.status === statusFilter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search);
    return matchStatus && matchSearch;
  });

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => { const s = new Set(prev); filtered.forEach((p) => s.delete(p.id)); return s; });
    } else {
      setSelected((prev) => { const s = new Set(prev); filtered.forEach((p) => s.add(p.id)); return s; });
    }
  }

  const counts = {
    all: participants.length,
    active: participants.filter((p) => p.status === 'active').length,
    completed: participants.filter((p) => p.status === 'completed').length,
    cancelled: participants.filter((p) => p.status === 'cancelled').length,
  };

  return (
    <AdminLayout
      title={`Participants (${participants.length})`}
      headerRight={
        <div className="flex items-center gap-2">
          {lastUpdated && <p className="text-gray-500 text-xs hidden md:block">Updated {lastUpdated.toLocaleTimeString()}</p>}
          <a
            href="/api/admin/participants/export.csv"
            className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            📥 Export CSV
          </a>
          {selected.size > 0 && (
            <button
              onClick={() => setConfirmBulk(true)}
              className="bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              🗑 Delete ({selected.size})
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {[
              { value: '', label: `All (${counts.all})` },
              { value: 'active', label: `Active (${counts.active})` },
              { value: 'completed', label: `Completed (${counts.completed})` },
              { value: 'cancelled', label: `Cancelled (${counts.cancelled})` },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  statusFilter === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/60">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="accent-blue-500"
                    />
                  </th>
                  {['Name', 'Phone', 'Status', 'Stage', 'Registered', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={(e) => {
                          const s = new Set(selected);
                          e.target.checked ? s.add(p.id) : s.delete(p.id);
                          setSelected(s);
                        }}
                        className="accent-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLES[p.status] ?? 'bg-gray-700 text-gray-400'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <div
                            key={n}
                            className={`w-3.5 h-3.5 rounded-sm ${
                              n < p.currentStage ? 'bg-green-500' : n === p.currentStage && p.status === 'active' ? 'bg-blue-400 animate-pulse' : 'bg-gray-700'
                            }`}
                            title={`Stage ${n}`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.registeredAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => doReset(p.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg bg-blue-900/20 hover:bg-blue-900/40 transition-colors font-medium"
                        >
                          ↺ Reset
                        </button>
                        {p.status === 'cancelled' && (
                          <button
                            onClick={() => {
                              setReregisterTarget(p);
                              setReregisterName('');
                              setReregisterPhone('');
                              setReregisterError('');
                              setReregisterSuccess('');
                            }}
                            className="text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded-lg bg-green-900/20 hover:bg-green-900/40 transition-colors font-medium"
                          >
                            🔄 Re-Register
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDelete(p)}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg bg-red-900/20 hover:bg-red-900/40 transition-colors font-medium"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-600">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-sm">No participants found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Single delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-white font-bold text-lg">Delete Participant?</h3>
            <div className="bg-gray-800 rounded-xl p-3 space-y-1">
              <p className="text-white font-medium">{confirmDelete.name}</p>
              <p className="text-gray-400 text-sm font-mono">{confirmDelete.phone}</p>
              <p className="text-gray-500 text-xs">Stage {confirmDelete.currentStage} · {confirmDelete.status}</p>
            </div>
            <p className="text-gray-400 text-sm">
              This will <strong className="text-red-400">permanently delete</strong> this participant and all their progress data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => doDelete(confirmDelete.id)}
                disabled={loading}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                {loading ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete modal */}
      {confirmBulk && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-white font-bold text-lg">Delete {selected.size} Participants?</h3>
            <p className="text-gray-400 text-sm">
              This will permanently delete <strong className="text-red-400">{selected.size} participants</strong> and all their progress. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={doBulkDelete}
                disabled={loading}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                {loading ? 'Deleting…' : `Delete ${selected.size}`}
              </button>
              <button
                onClick={() => setConfirmBulk(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Re-register modal (admin testing) */}
      {reregisterTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔄</span>
              <h3 className="text-white font-bold text-lg">Re-Register Participant</h3>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 space-y-1">
              <p className="text-white font-medium">{reregisterTarget.name}</p>
              <p className="text-gray-400 text-sm font-mono">{reregisterTarget.phone}</p>
              <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">{reregisterTarget.status}</span>
            </div>
            <p className="text-gray-400 text-sm">
              Enter the exact <strong className="text-white">name</strong> and <strong className="text-white">phone number</strong> of this participant to confirm re-registration. This will reset their progress to Stage 1.
            </p>
            <form onSubmit={doReregister} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm Name</label>
                <input
                  value={reregisterName}
                  onChange={(e) => setReregisterName(e.target.value)}
                  placeholder={reregisterTarget.name}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm Phone</label>
                <input
                  value={reregisterPhone}
                  onChange={(e) => setReregisterPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder={reregisterTarget.phone}
                  inputMode="numeric"
                  maxLength={10}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {reregisterError && (
                <p className="text-red-400 text-xs bg-red-900/20 border border-red-700 rounded-lg px-3 py-2">❌ {reregisterError}</p>
              )}
              {reregisterSuccess && (
                <p className="text-green-400 text-xs bg-green-900/20 border border-green-700 rounded-lg px-3 py-2">{reregisterSuccess}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={loading || !reregisterName.trim() || reregisterPhone.length !== 10}
                  className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {loading ? 'Processing…' : '✅ Re-Register'}
                </button>
                <button
                  type="button"
                  onClick={() => { setReregisterTarget(null); setReregisterError(''); setReregisterSuccess(''); }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
