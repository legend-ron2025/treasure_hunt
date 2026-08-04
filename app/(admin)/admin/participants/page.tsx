'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Participant = { id: string; name: string; phone: string; status: string; currentStage: number; registeredAt: string; };

export default function ParticipantList() {
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Participant | null>(null);

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  async function load() {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    const res = await fetch('/api/admin/participants', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setParticipants(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function doDelete(id: string) {
    const token = getToken();
    await fetch(`/api/admin/participants/${id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ confirm: true }),
    });
    setConfirmDelete(null);
    load();
  }

  async function doReset(id: string) {
    const token = getToken();
    await fetch(`/api/admin/participants/${id}/reset`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    load();
  }

  async function doBulkDelete() {
    if (selected.size === 0) return;
    const token = getToken();
    await fetch('/api/admin/participants', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: Array.from(selected), confirm: true }),
    });
    setSelected(new Set());
    load();
  }

  const filtered = participants.filter((p) =>
    !filter || p.status === filter || p.name.toLowerCase().includes(filter.toLowerCase())
  );

  const statusColor: Record<string, string> = { active: 'text-green-700 bg-green-50', completed: 'text-yellow-700 bg-yellow-50', cancelled: 'text-gray-500 bg-gray-100' };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-800 text-white px-4 py-3 flex gap-4 text-sm">
        <a href="/admin/dashboard" className="hover:text-blue-300">Dashboard</a>
        <a href="/admin/participants" className="text-blue-300">Participants</a>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Participants ({participants.length})</h1>
          <div className="flex gap-2 flex-wrap">
            <a href="/api/admin/participants/export.csv" className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">Export CSV</a>
            {selected.size > 0 && <button onClick={doBulkDelete} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700">Delete Selected ({selected.size})</button>}
          </div>
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          {['', 'active', 'completed', 'cancelled'].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 rounded-full text-sm ${filter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>{s || 'All'}</button>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 w-8"><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((p) => p.id)) : new Set())} /></th>
                {['Name', 'Phone', 'Status', 'Stage', 'Registered', 'Actions'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2"><input type="checkbox" checked={selected.has(p.id)} onChange={(e) => { const s = new Set(selected); e.target.checked ? s.add(p.id) : s.delete(p.id); setSelected(s); }} /></td>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-gray-500">{p.phone}</td>
                  <td className="px-3 py-2"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[p.status] ?? ''}`}>{p.status}</span></td>
                  <td className="px-3 py-2">{p.currentStage}</td>
                  <td className="px-3 py-2 text-gray-400">{new Date(p.registeredAt).toLocaleString()}</td>
                  <td className="px-3 py-2 flex gap-2">
                    <button onClick={() => doReset(p.id)} className="text-xs text-blue-600 hover:text-blue-800">Reset</button>
                    <button onClick={() => setConfirmDelete(p)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="font-bold text-gray-800">Delete Participant?</h3>
            <p className="text-sm text-gray-600">This will permanently delete <strong>{confirmDelete.name}</strong> ({confirmDelete.phone}) and all their data. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => doDelete(confirmDelete.id)} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700">Delete</button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
