'use client';
/**
 * /admin/reregister
 *
 * Admin-only page to re-register cancelled participants for testing.
 * Shows all cancelled participants. Admin selects one, enters their exact
 * name + phone to confirm, then the participant is reset to Stage 1.
 */
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

type Participant = {
  id: string;
  name: string;
  phone: string;
  status: string;
  currentStage: number;
  registeredAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
};

const REASON_LABELS: Record<string, string> = {
  dropout_tab_close: 'Closed tab',
  dropout_navigation: 'Navigated away',
  dropout_inactivity: 'Inactivity timeout',
  admin_manual: 'Admin cancelled',
};

export default function ReregisterPage() {
  const router = useRouter();
  const [cancelled, setCancelled] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Participant | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [confirmPhone, setConfirmPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  async function load() {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    // Add timestamp to bypass any browser-level caching
    const ts = Date.now();
    const res = await fetch(`/api/admin/participants?status=cancelled&_t=${ts}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.status === 401) { router.replace('/admin/login'); return; }
    if (res.ok) setCancelled(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Auto-refresh every 3 seconds so new cancellations appear immediately
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openModal(p: Participant) {
    setSelected(p);
    setConfirmName('');
    setConfirmPhone('');
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    setSuccess('');
    setSubmitting(true);

    const token = getToken();
    const res = await fetch(`/api/admin/participants/${selected.id}/reregister`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: confirmName.trim(), phone: confirmPhone.trim() }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? 'Re-registration failed.');
    } else {
      setSuccess(`✅ ${data.message}`);
      setTimeout(() => {
        setSelected(null);
        load();
      }, 1800);
    }
  }

  const filtered = cancelled.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search),
  );

  return (
    <AdminLayout
      title="Re-Registration (Testing)"
      headerRight={
        <span className="text-xs text-amber-400 bg-amber-900/30 border border-amber-700 px-3 py-1.5 rounded-lg">
          🔬 Testing Mode
        </span>
      }
    >
      <div className="max-w-4xl space-y-5">
        {/* Info banner */}
        <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-4 text-amber-300 text-sm space-y-1">
          <p className="font-semibold">⚠️ Admin Testing Feature</p>
          <p className="text-xs text-amber-400">
            Re-registration allows cancelled participants to restart the event from Stage 1.
            This is intended for testing only. The admin must confirm the student&apos;s exact name
            and phone number before re-registering.
          </p>
        </div>

        {/* Search */}
        <input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-sm"
        />

        {/* Cancelled participants table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-sm">
              {cancelled.length === 0
                ? 'No cancelled participants found.'
                : 'No results match your search.'}
            </p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-3 border-b border-gray-700 flex items-center justify-between">
              <p className="text-white font-semibold text-sm">{filtered.length} Cancelled Participant{filtered.length !== 1 ? 's' : ''}</p>
              <p className="text-gray-500 text-xs">Click &quot;Re-Register&quot; on any row to restore access</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/50">
                    {['Name', 'Phone', 'Stage at Cancel', 'Reason', 'Cancelled At', 'Action'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.phone}</td>
                      <td className="px-4 py-3 text-gray-300 text-center">{p.currentStage}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                          {p.cancelReason ? (REASON_LABELS[p.cancelReason] ?? p.cancelReason) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {p.cancelledAt ? new Date(p.cancelledAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openModal(p)}
                          className="text-xs text-green-400 hover:text-green-300 px-3 py-1.5 rounded-lg bg-green-900/20 hover:bg-green-900/50 border border-green-800 transition-colors font-medium"
                        >
                          🔄 Re-Register
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔄</span>
              <div>
                <h3 className="text-white font-bold text-lg">Re-Register Participant</h3>
                <p className="text-gray-500 text-xs">Testing mode — confirms identity before re-activating</p>
              </div>
            </div>

            {/* Participant info card */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs w-16">Name:</span>
                <span className="text-white font-medium">{selected.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs w-16">Phone:</span>
                <span className="text-gray-300 font-mono text-sm">{selected.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs w-16">Stage:</span>
                <span className="text-gray-300">{selected.currentStage} (will reset to 1)</span>
              </div>
            </div>

            <p className="text-gray-400 text-sm">
              Enter the <strong className="text-white">exact name</strong> and <strong className="text-white">exact phone number</strong> to confirm.
              This re-activates the participant from Stage 1 with all progress cleared.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Confirm Name <span className="text-gray-600">(case-insensitive)</span>
                </label>
                <input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Enter student's exact name"
                  autoComplete="off"
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Confirm Phone <span className="text-gray-600">(10 digits)</span>
                </label>
                <input
                  value={confirmPhone}
                  onChange={(e) => setConfirmPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit phone number"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="off"
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
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

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting || !confirmName.trim() || confirmPhone.length !== 10}
                  className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {submitting ? 'Processing…' : '✅ Confirm Re-Register'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
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
