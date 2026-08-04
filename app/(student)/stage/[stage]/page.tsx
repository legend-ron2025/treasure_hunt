'use client';
import { useEffect, useState, useRef, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';
import SessionWarningBanner from '@/components/SessionWarningBanner';
import type { StageContentResponse, SubmitAccessCodeResponse } from '@/lib/types';

export default function StagePage() {
  const router = useRouter();
  const params = useParams<{ stage: string }>();
  const stageNumber = parseInt(params.stage, 10);

  const [content, setContent] = useState<StageContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessCode, setAccessCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('studentToken');
    if (!token) { router.replace('/register'); return; }

    fetch(`/api/student/stage/${stageNumber}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 403) return r.json().then((d: { error: string }) => { throw { redirect: true, msg: d.error }; });
        if (!r.ok) throw new Error('Failed to load stage');
        return r.json();
      })
      .then((data: StageContentResponse) => { setContent(data); setLoading(false); })
      .catch((e) => {
        if (e?.redirect) {
          // Redirect to correct stage or handle cancellation
          router.replace('/register');
        } else {
          setApiError('Failed to load stage content.');
          setLoading(false);
        }
      });

    // Heartbeat
    const hb = setInterval(() => {
      const t = localStorage.getItem('studentToken');
      if (t && !document.hidden) {
        navigator.sendBeacon('/api/student/heartbeat', new Blob([JSON.stringify({})], { type: 'application/json' }));
      }
    }, 2 * 60 * 1000);

    function beforeUnload() {
      const t = localStorage.getItem('studentToken');
      if (t) navigator.sendBeacon('/api/student/dropout', new Blob([JSON.stringify({ reason: 'dropout_tab_close' })], { type: 'application/json' }));
    }
    function visChange() {
      const t = localStorage.getItem('studentToken');
      if (!t) return;
      if (document.hidden) {
        visibilityTimerRef.current = setTimeout(() => {
          navigator.sendBeacon('/api/student/dropout', new Blob([JSON.stringify({ reason: 'dropout_navigation' })], { type: 'application/json' }));
        }, 5000);
      } else {
        if (visibilityTimerRef.current) { clearTimeout(visibilityTimerRef.current); visibilityTimerRef.current = null; }
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', visChange);
    return () => {
      clearInterval(hb);
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('visibilitychange', visChange);
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
    };
  }, [router, stageNumber]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError('');
    if (!/^[A-Za-z0-9]{6}$/.test(accessCode)) {
      setCodeError('Access code must be 6 characters.');
      return;
    }
    setCodeError('');
    setSubmitting(true);
    const token = localStorage.getItem('studentToken');
    try {
      const res = await fetch(`/api/student/stage/${stageNumber}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accessCode }),
      });
      const data: SubmitAccessCodeResponse = await res.json();
      if (!res.ok || !data.success) {
        setApiError(data.error ?? 'Incorrect access code. Please try again.');
        return;
      }
      if (data.nextAction?.type === 'scan_qr') {
        router.push(`/qr/scan/${data.nextAction.nextStage}`);
      } else {
        router.push('/congratulations');
      }
    } catch {
      setApiError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <CollegeHeader />
      <main className="flex-1 flex items-center justify-center"><p className="text-gray-500">Loading stage…</p></main>
      <SessionWarningBanner />
    </div>
  );

  const difficultyColors: Record<string, string> = {
    'Medium': 'bg-green-100 text-green-800',
    'Medium-Hard': 'bg-yellow-100 text-yellow-800',
    'Hard': 'bg-orange-100 text-orange-800',
    'Very Hard': 'bg-red-100 text-red-800',
    'Final Boss 🏆': 'bg-purple-100 text-purple-800',
  };
  const diffClass = difficultyColors[content?.difficulty ?? ''] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <CollegeHeader />
      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-5">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">Stage {stageNumber}</h2>
          {content && <span className={`text-xs font-semibold px-2 py-1 rounded-full ${diffClass}`}>{content.difficulty}</span>}
        </div>

        {content && (
          <>
            <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Puzzle</h3>
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{content.puzzleText}</p>
              </div>

              {stageNumber < 5 && content.hintText && (
                <div className="border-t pt-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Hint</h3>
                  <p className="text-blue-700 text-sm italic">{content.hintText}</p>
                </div>
              )}

              {stageNumber < 5 && content.wordFragment && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Your Word Fragment</p>
                  <p className="text-2xl font-bold text-amber-800 tracking-widest">{content.wordFragment}</p>
                  <p className="text-xs text-amber-600 mt-1">Remember this — you will need it at the Final Boss stage!</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
              <div>
                <label htmlFor="access-code" className="block text-sm font-medium text-gray-700 mb-1">
                  Enter Access Code
                </label>
                <input
                  id="access-code"
                  type="text"
                  maxLength={6}
                  autoCapitalize="characters"
                  value={accessCode}
                  onChange={(e) => { setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setCodeError(''); }}
                  aria-invalid={!!codeError}
                  aria-describedby={codeError ? 'code-error' : undefined}
                  className={`w-full px-4 py-3 border rounded-lg text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 min-h-[56px] ${codeError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-blue-500'}`}
                  placeholder="XXXXXX"
                />
                {codeError && <p id="code-error" role="alert" className="mt-1 text-xs text-red-600">{codeError}</p>}
              </div>

              {apiError && (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-sm text-red-700">{apiError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg min-h-[44px] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Checking…' : 'Submit Code'}
              </button>
            </form>
          </>
        )}

        {apiError && !content && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">{apiError}</p>
          </div>
        )}
      </main>
      <SessionWarningBanner />
    </div>
  );
}
