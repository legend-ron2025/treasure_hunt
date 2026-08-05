'use client';
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

type BanEntry = { id: string; name: string | null; phone: string | null; addedAt: string };

export default function BanListPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<BanEntry[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  async function loadEntries() {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    const res = await fetch('/api/admin/ban', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setEntries(await res.json());
  }

  useEffect(() => { loadEntries(); }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() && !phone.trim()) {
      setError('At least one of name or phone number is required.');
      return;
    }
    setLoading(true);
    const token = getToken();
    const res = await fetch('/api/admin/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: name.trim() || null, phone: phone.trim() || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Add failed.');
    } else {
      setName(''); setPhone('');
      loadEntries();
    }
    setLoading(false);
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    const token = getToken();
    await fetch(`/api/admin/ban/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setRemoving(null);
    loadEntries();
  }

  return (
    <AdminLayout
      title="Ban List"
      headerRight={
        <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 rounded-lg">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
      }
    >
      <div className="max-w-2xl space-y-5">
        {/* Add form */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-semibold">Add Ban Entry</h2>
          <p className="text-gray-500 text-sm">
            Ban by name, phone, or both. If a student matches either field, they cannot register.
          </p>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Name (optional)</label>
                <input
                  placeholder="Student's full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone (optional)</label>
                <input
                  placeholder="10-digit phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  inputMode="numeric"
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-2.5 text-red-300 text-sm">
                ❌ {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding…</>
              ) : '🚫 Add to Ban List'}
            </button>
          </form>
        </div>

        {/* Entries table */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-700">
            <h2 className="text-white font-semibold">Banned Entries</h2>
          </div>
          {entries.length === 0 ? (
            <div className="text-center py-10 text-gray-600">
              <p className="text-3xl mb-2">🚫</p>
              <p className="text-sm">No ban entries yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div>
                      {e.name && <p className="text-white text-sm font-medium">{e.name}</p>}
                      {e.phone && <p className="text-gray-400 text-sm font-mono">{e.phone}</p>}
                      {!e.name && !e.phone && <p className="text-gray-600 text-sm italic">No data</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-gray-600 text-xs hidden sm:block">{new Date(e.addedAt).toLocaleDateString()}</p>
                    <button
                      onClick={() => handleRemove(e.id)}
                      disabled={removing === e.id}
                      className="text-red-400 hover:text-red-300 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-900/20 hover:bg-red-900/40 transition-colors disabled:opacity-50"
                    >
                      {removing === e.id ? '…' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
