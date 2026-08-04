'use client';
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type BanEntry = { id: string; name: string | null; phone: string | null; addedAt: string; };

export default function BanListPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<BanEntry[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (!name.trim() && !phone.trim()) { setError('At least one of name or phone number is required.'); return; }
    setLoading(true);
    const token = getToken();
    const res = await fetch('/api/admin/ban', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: name.trim() || null, phone: phone.trim() || null }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Add failed.'); }
    else { setName(''); setPhone(''); loadEntries(); }
    setLoading(false);
  }

  async function handleRemove(id: string) {
    const token = getToken();
    await fetch(`/api/admin/ban/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    loadEntries();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-800 text-white px-4 py-3 flex gap-4 text-sm">
        <a href="/admin/dashboard" className="hover:text-blue-300">Dashboard</a>
        <a href="/admin/ban" className="text-blue-300">Ban List</a>
      </nav>
      <main className="p-6 max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Ban List</h1>
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <h3 className="font-semibold text-gray-700">Add Ban Entry</h3>
          <input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} maxLength={10} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Adding…' : 'Add to Ban List'}
          </button>
        </form>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Name</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Phone</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Added</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{e.name ?? '—'}</td>
                  <td className="px-4 py-2">{e.phone ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(e.addedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => handleRemove(e.id)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-gray-400 text-center">No ban entries.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
