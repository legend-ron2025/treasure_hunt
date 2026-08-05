'use client';
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

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
  const [resetHistory, setResetHistory] = useState<{ id: string; performedAt: string; performedBy: string; participantsDeleted: number }[]>([]);
  const [currentStatus, setCurrentStatus] = useState<{ status: string; startTime: string | null; endTime: string | null } | null>(null);

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    fetch('/api/admin/event', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setStartTime(toLocalInput(d.startTime));
          setEndTime(toLocalInput(d.endTime));
        }
      });
    fetch('/api/time', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) setCurrentStatus({ status: d.eventStatus, startTime: d.startTime, endTime: d.endTime });
    });
    fetch('/api/admin/reset-log', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : []).then(setResetHistory);
  }, [router]);

  function parseLocal(dtLocal: string): Date {
    const [datePart, timePart] = dtLocal.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!startTime || !endTime) { setError('Please enter both start and end times.'); return; }
    const startDate = parseLocal(startTime);
    const endDate = parseLocal(endTime);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { setError('Invalid date values.'); return; }
    if (endDate <= startDate) { setError('End time must be later than start time.'); return; }
    if (endDate.getTime() - startDate.getTime() < 60_000) { setError('End time must be at least 1 minute after start time.'); return; }

    setSaving(true);
    const token = getToken();
    const res = await fetch('/api/admin/event', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ startTime: startDate.toISOString(), endTime: endDate.toISOString() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Save failed.');
    } else {
      setSuccess(`✅ Schedule saved! Event runs from ${startDate.toLocaleString()} to ${endDate.toLocaleString()}`);
      // Broadcast schedule change to other tabs (countdown page listens for this)
      try { localStorage.setItem('scheduleUpdated', Date.now().toString()); } catch {}
      fetch('/api/time').then((r) => r.json()).then((d) => setCurrentStatus({ status: d.eventStatus, startTime: d.startTime, endTime: d.endTime }));
    }
    setSaving(false);
  }

  async function handleReset() {
    if (resetConfirm !== 'RESET EVENT') { setResetError('Type "RESET EVENT" exactly.'); return; }
    setResetting(true); setResetError('');
    const token = getToken();
    const res = await fetch('/api/admin/event/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ confirm: 'RESET EVENT' }),
    });
    const data = await res.json();
    if (!res.ok) {
      setResetError(data.error ?? 'Reset failed.');
    } else {
      setResetConfirm('');
      setStartTime('');
      setEndTime('');
      setSuccess('');
      alert(`✅ Event reset complete. ${data.participantsDeleted} participants deleted.`);
      window.location.reload();
    }
    setResetting(false);
  }

  const statusBadge = currentStatus
    ? currentStatus.status === 'active'
      ? 'bg-green-900/50 text-green-300 border border-green-700'
      : currentStatus.status === 'before'
      ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
      : 'bg-gray-800 text-gray-400 border border-gray-600'
    : null;

  return (
    <AdminLayout title="Event Schedule">
      <div className="max-w-2xl space-y-6">
        {/* Current status badge */}
        {currentStatus && (
          <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${statusBadge}`}>
            <span className="text-lg">
              {currentStatus.status === 'active' ? '🟢' : currentStatus.status === 'before' ? '🔵' : '⚫'}
            </span>
            <div>
              <p className="font-semibold text-sm capitalize">
                Event is {currentStatus.status === 'before' ? 'upcoming' : currentStatus.status}
              </p>
              {currentStatus.startTime && (
                <p className="text-xs opacity-70">
                  {currentStatus.startTime && new Date(currentStatus.startTime).toLocaleString()}
                  {currentStatus.endTime && ` → ${new Date(currentStatus.endTime).toLocaleString()}`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Schedule form */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-5">
          <h2 className="text-white font-semibold text-lg">Set Event Window</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Event Start</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Event End</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-2.5 text-red-300 text-sm">
                ❌ {error}
              </div>
            )}
            {success && (
              <div className="bg-green-900/30 border border-green-700 rounded-xl px-4 py-2.5 text-green-300 text-sm">
                {success}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
              ) : '💾 Save Schedule'}
            </button>
          </form>
        </div>

        {/* Reset event */}
        <div className="bg-gray-900 border border-red-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <h2 className="text-red-400 font-semibold text-lg">Reset Event</h2>
          </div>
          <p className="text-gray-400 text-sm">
            This will <strong className="text-red-400">permanently delete ALL participants</strong> and clear the event schedule.
            Stage content, QR codes, and ban list will be preserved. This cannot be undone.
          </p>
          <div className="space-y-3">
            <label className="block text-sm text-gray-400">
              Type <code className="bg-gray-800 px-1.5 py-0.5 rounded text-red-300 font-mono">RESET EVENT</code> to confirm
            </label>
            <input
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder="RESET EVENT"
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            {resetError && (
              <p className="text-red-400 text-sm">❌ {resetError}</p>
            )}
            <button
              onClick={handleReset}
              disabled={resetting || resetConfirm !== 'RESET EVENT'}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              {resetting ? 'Resetting…' : '🗑 Reset Event'}
            </button>
          </div>
        </div>

        {/* Reset history */}
        {resetHistory.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Reset History</h2>
            <div className="space-y-2">
              {resetHistory.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-xl text-sm">
                  <div>
                    <p className="text-gray-300">{new Date(r.performedAt).toLocaleString()}</p>
                    <p className="text-gray-500 text-xs">by {r.performedBy}</p>
                  </div>
                  <span className="text-red-400 font-medium">{r.participantsDeleted} deleted</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
