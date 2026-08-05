'use client';
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

type StageData = {
  stageNumber: number;
  difficulty: string;
  puzzleText: string;
  hintText: string | null;
  wordFragment: string | null;
  accessCode: string;
};

const DIFFICULTY_COLORS: Record<number, string> = {
  1: 'bg-green-900/40 text-green-300 border-green-700',
  2: 'bg-blue-900/40 text-blue-300 border-blue-700',
  3: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  4: 'bg-orange-900/40 text-orange-300 border-orange-700',
  5: 'bg-red-900/40 text-red-300 border-red-700',
};

export default function ContentManagement() {
  const router = useRouter();
  const [stages, setStages] = useState<StageData[]>([]);
  const [editing, setEditing] = useState<Record<number, Partial<StageData>>>({});
  const [open, setOpen] = useState<number | null>(1);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [success, setSuccess] = useState<Record<number, boolean>>({});

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    fetch('/api/admin/stages', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then(setStages);
  }, [router]);

  function getField(n: number, field: keyof StageData): string {
    const e = editing[n];
    if (e && field in e) return (e[field] as string) ?? '';
    const s = stages.find((s) => s.stageNumber === n);
    return s ? (s[field] as string) ?? '' : '';
  }

  function setField(n: number, field: keyof StageData, value: string) {
    setEditing((prev) => ({ ...prev, [n]: { ...prev[n], [field]: value } }));
  }

  async function handleSave(e: FormEvent, n: number) {
    e.preventDefault();
    const token = getToken();
    setSaving((p) => ({ ...p, [n]: true }));
    setErrors((p) => ({ ...p, [n]: '' }));
    const body = {
      puzzleText: getField(n, 'puzzleText'),
      hintText: getField(n, 'hintText') || null,
      wordFragment: getField(n, 'wordFragment') || null,
      accessCode: getField(n, 'accessCode'),
    };
    const res = await fetch(`/api/admin/stages/${n}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrors((p) => ({ ...p, [n]: data.error ?? 'Save failed.' }));
    } else {
      setSuccess((p) => ({ ...p, [n]: true }));
      // Update local state
      setStages((prev) => prev.map((s) => s.stageNumber === n ? { ...s, ...body, accessCode: body.accessCode } : s));
      setTimeout(() => setSuccess((p) => ({ ...p, [n]: false })), 3000);
    }
    setSaving((p) => ({ ...p, [n]: false }));
  }

  const stageNames = ['Binary Decoder', 'Mirror Text', 'Password Challenge', 'Caesar Cipher', 'Final Boss'];

  return (
    <AdminLayout title="Content Management">
      <div className="max-w-3xl space-y-3">
        <p className="text-gray-500 text-sm mb-4">
          Edit puzzles, hints, word fragments, and access codes for each stage.
          Changes take effect immediately for all students.
        </p>
        {[1, 2, 3, 4, 5].map((n) => {
          const stage = stages.find((s) => s.stageNumber === n);
          const isOpen = open === n;
          return (
            <div key={n} className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
              {/* Accordion header */}
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : n)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold text-base">Stage {n}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${DIFFICULTY_COLORS[n]}`}>
                    {stage?.difficulty ?? '…'}
                  </span>
                  <span className="text-gray-500 text-sm">{stageNames[n - 1]}</span>
                </div>
                <span className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {/* Accordion body */}
              {isOpen && (
                <form onSubmit={(e) => handleSave(e, n)} className="px-5 pb-5 space-y-4 border-t border-gray-700">
                  {/* Puzzle */}
                  <div className="pt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Puzzle Text <span className="text-gray-500 text-xs">(max 2000 chars)</span>
                    </label>
                    <textarea
                      value={getField(n, 'puzzleText')}
                      onChange={(e) => setField(n, 'puzzleText', e.target.value)}
                      maxLength={2000}
                      rows={4}
                      placeholder="Enter the puzzle or challenge text students will see…"
                      className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                    />
                  </div>

                  {/* Hint (stages 1-4 only) */}
                  {n < 5 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Hint <span className="text-gray-500 text-xs">(points to next QR location, max 500 chars)</span>
                      </label>
                      <textarea
                        value={getField(n, 'hintText')}
                        onChange={(e) => setField(n, 'hintText', e.target.value)}
                        maxLength={500}
                        rows={2}
                        placeholder="Hint about where to find the next QR code…"
                        className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* Word fragment (stages 1-4 only) */}
                  {n < 5 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Word Fragment <span className="text-gray-500 text-xs">(shown to student; used in Final Boss)</span>
                      </label>
                      <input
                        value={getField(n, 'wordFragment')}
                        onChange={(e) => setField(n, 'wordFragment', e.target.value)}
                        maxLength={20}
                        placeholder="e.g. WI, N, N, ER"
                        className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* Access code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Access Code <span className="text-gray-500 text-xs">(exactly 6 alphanumeric — printed on physical QR card)</span>
                    </label>
                    <input
                      value={getField(n, 'accessCode')}
                      onChange={(e) => setField(n, 'accessCode', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                      maxLength={6}
                      placeholder="e.g. LAB001"
                      className="w-48 bg-gray-800 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Error / success */}
                  {errors[n] && (
                    <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-2.5 text-red-300 text-sm">
                      ❌ {errors[n]}
                    </div>
                  )}
                  {success[n] && (
                    <div className="bg-green-900/30 border border-green-700 rounded-xl px-4 py-2.5 text-green-300 text-sm">
                      ✅ Stage {n} saved successfully!
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={saving[n]}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {saving[n] ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                    ) : '💾 Save Stage'}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
