'use client';
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function EventSchedule() {
  const router = useRouter();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetHistory, setResetHistory] = useState<any[]>([]);

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    fetch('/api/admin/event', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setStartTime(toLocalInput(d.startTime)); setEndTime(toLocalInput(d.endTime)); } });
    fetch('/api/admin/reset-log', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : []).then(setResetHistory);
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (new Date(endTime) <= new Date(startTime)) { setError('End time must be later than start time.'); return; }
    setSaving(true);
    const token = getToken();
    const res = await fetch('/api/admin/event', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ startTime: new Date(startTime).toISOString(), endTime: new Date(endTime).toISOString() }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? 'Save failed.');
    else setSuccess('Event schedule saved!');
    setSaving(false);
  }

  async function handleReset() {
    if (resetConfirm !== 'RESET EVENT') { setResetError('Type "RESET EVENT" exactly.'); return; }
    setResetting(true); setResetError('');
    const token = getToken();
    const res = await fetch('/api/admin/event/reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ confirm: 'RESET EVENT' }),
    });
    const data = await res.json();
    if (!res.ok) setResetError(data.error ?? 'Reset failed.');
    else { setResetConfirm(''); alert(`Reset complete. ${data.participantsDeleted} participants deleted.`); window.location.reload(); }
    setResetting(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-800 text-white px-4 py-3 flex gap-4 text-sm">
        <a href="/admin/dashboard" className="hover:text-blue-300">Dashboard</a>
        <a href="/admin/schedule" className="text-blue-300">Schedule</a>
      </nav>
      <main className="p-6 max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Event Schedule</h1>
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Start</label>
            <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event End</label>
            <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save Schedule'}</button>
        </form>

        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3 border-l-4 border-red-400">
          <h3 className="font-semibold text-red-700">Reset Event</h3>
          <p className="text-sm text-gray-600">This will delete ALL participants and clear the event schedule. This cannot be undone.</p>
          <input placeholder='Type "RESET EVENT" to confirm' value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
          {resetError && <p className="text-sm text-red-600">{resetError}</p>}
          <button onClick={handleReset} disabled={resetting || resetConfirm !== 'RESET EVENT'} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">{resetting ? 'Resetting…' : 'Reset Event'}</button>
        </div>

        {resetHistory.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-3">Reset History</h3>
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Date</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">By</th>
                <th className="px-3 py-2 text-left text-xs text-gray-500">Deleted</th>
              </tr></thead>
              <tbody>{resetHistory.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{new Date(r.performedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.performedBy}</td>
                  <td className="px-3 py-2">{r.participantsDeleted}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
