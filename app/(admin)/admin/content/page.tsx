'use client';
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type StageData = { stageNumber: number; difficulty: string; puzzleText: string; hintText: string | null; wordFragment: string | null; accessCode: string; };

export default function ContentManagement() {
  const router = useRouter();
  const [stages, setStages] = useState<StageData[]>([]);
  const [editing, setEditing] = useState<Record<number, Partial<StageData>>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [success, setSuccess] = useState<Record<number, boolean>>({});

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    fetch('/api/admin/stages', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : []).then(setStages);
  }, []);

  function getField(stageNumber: number, field: keyof StageData): string {
    const e = editing[stageNumber];
    if (e && field in e) return (e[field] as string) ?? '';
    const s = stages.find((s) => s.stageNumber === stageNumber);
    return s ? (s[field] as string) ?? '' : '';
  }

  function setField(stageNumber: number, field: keyof StageData, value: string) {
    setEditing((prev) => ({ ...prev, [stageNumber]: { ...prev[stageNumber], [field]: value } }));
  }

  async function handleSave(e: FormEvent, stageNumber: number) {
    e.preventDefault();
    const token = getToken();
    setSaving((p) => ({ ...p, [stageNumber]: true }));
    setErrors((p) => ({ ...p, [stageNumber]: '' }));
    const body = {
      puzzleText: getField(stageNumber, 'puzzleText'),
      hintText: getField(stageNumber, 'hintText') || null,
      wordFragment: getField(stageNumber, 'wordFragment') || null,
      accessCode: getField(stageNumber, 'accessCode'),
    };
    const res = await fetch(`/api/admin/stages/${stageNumber}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setErrors((p) => ({ ...p, [stageNumber]: data.error ?? 'Save failed.' })); }
    else { setSuccess((p) => ({ ...p, [stageNumber]: true })); setTimeout(() => setSuccess((p) => ({ ...p, [stageNumber]: false })), 3000); }
    setSaving((p) => ({ ...p, [stageNumber]: false }));
  }

  const difficulties = ['Medium', 'Medium-Hard', 'Hard', 'Very Hard', 'Final Boss 🏆'];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-800 text-white px-4 py-3 flex gap-4 text-sm">
        <a href="/admin/dashboard" className="hover:text-blue-300">Dashboard</a>
        <a href="/admin/content" className="text-blue-300">Content</a>
      </nav>
      <main className="p-6 max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Content Management</h1>
        {[1, 2, 3, 4, 5].map((n) => (
          <details key={n} className="bg-white rounded-xl shadow-sm border">
            <summary className="p-4 cursor-pointer font-semibold text-gray-700 flex items-center gap-2">
              Stage {n} <span className="text-xs font-normal text-gray-400">{difficulties[n - 1]}</span>
            </summary>
            <form onSubmit={(e) => handleSave(e, n)} className="p-4 space-y-3 border-t">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Puzzle Text</label>
                <textarea value={getField(n, 'puzzleText')} onChange={(e) => setField(n, 'puzzleText', e.target.value)} maxLength={2000} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {n < 5 && <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hint Text</label>
                <textarea value={getField(n, 'hintText')} onChange={(e) => setField(n, 'hintText', e.target.value)} maxLength={500} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>}
              {n < 5 && <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Word Fragment</label>
                <input value={getField(n, 'wordFragment')} onChange={(e) => setField(n, 'wordFragment', e.target.value)} maxLength={20} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Access Code (6 alphanumeric)</label>
                <input value={getField(n, 'accessCode')} onChange={(e) => setField(n, 'accessCode', e.target.value.toUpperCase())} maxLength={6} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {errors[n] && <p className="text-sm text-red-600">{errors[n]}</p>}
              {success[n] && <p className="text-sm text-green-600">Saved successfully!</p>}
              <button type="submit" disabled={saving[n]} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving[n] ? 'Saving…' : 'Save Stage'}
              </button>
            </form>
          </details>
        ))}
      </main>
    </div>
  );
}
