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
  const visibilityTimerRef = useRef<number | null>(null);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 5) {
      router.replace('/register');
      return;
    }

    // Redirect to canonical domain if necessary (handles old/deleted QR links)
    try {
      const canonical = process.env.NEXT_PUBLIC_BASE_URL;
      if (canonical && typeof window !== 'undefined') {
        const canonicalHost = new URL(canonical).host.replace(/:\d+$/, '');
        if (window.location.host.replace(/:\d+$/, '') !== canonicalHost) {
          window.location.replace(canonical.replace(/\/$/, '') + window.location.pathname + window.location.search);
          return;
        }
      }
    } catch (e) {
      // ignore
    }
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
          // We need participant's current_stage to redirect properly — fetch it
          const t = localStorage.getItem('studentToken');
          if (t) {
            fetch('/api/student/me', { headers: { Authorization: `Bearer ${t}` } })
              .then((r) => r.ok ? r.json() : null)
                  .then((me) => {
                if (!me || me.status === 'cancelled') { router.replace('/register'); return; }
                if (me.currentStage >= 6 || me.status === 'completed') { router.replace('/congratulations'); return; }
                // Already past this stage — go to next pending stage QR scan
                if (me.currentStage > stageNumber) {
                  router.replace(`/qr/scan/${me.currentStage}`);
                } else {
                  router.replace(`/stage/${me.currentStage}`);
                }
              })
              .catch(() => router.replace('/register'));
          } else {
            router.replace('/register');
          }
        } else {
          setApiError('Failed to load stage content.');
          setLoading(false);
        }
      });

    function safeSendBeacon(url: string, payload: unknown) {
      if (typeof navigator?.sendBeacon !== 'function') return false;
      try {
        return navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch {
        return false;
      }
    }

    const hb = setInterval(() => {
      const t = localStorage.getItem('studentToken');
      if (t && !document.hidden) {
        safeSendBeacon('/api/student/heartbeat', { token: t });
      }
    }, 2 * 60 * 1000);

    function sendDropout(reason: 'dropout_tab_close' | 'dropout_navigation') {
      if (isNavigatingRef.current) return;
      const t = localStorage.getItem('studentToken');
      if (!t) return;
      safeSendBeacon('/api/student/dropout', { token: t, reason });
    }

    function handleBeforeUnload() {
      sendDropout('dropout_tab_close');
    }

    function handleVisibilityChange() {
      const t = localStorage.getItem('studentToken');
      if (!t) return;
      if (document.hidden) {
        visibilityTimerRef.current = window.setTimeout(() => {
          sendDropout('dropout_navigation');
        }, 5000);
      } else {
        if (visibilityTimerRef.current) { clearTimeout(visibilityTimerRef.current); visibilityTimerRef.current = null; }
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(hb);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      isNavigatingRef.current = true;
      if (data.nextAction?.type === 'scan_qr') {
        window.location.href = `${window.location.origin}/qr/scan/${data.nextAction.nextStage}`;
        return;
      }
      window.location.href = `${window.location.origin}/congratulations`;
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
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              isNavigatingRef.current = true;
              router.push(`/qr/scan/${stageNumber}`);
            }}
            className="text-sm bg-emerald-600 text-white px-3 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20"
          >
            📷 Scan QR for this stage
          </button>
          <p className="text-sm text-gray-500 leading-relaxed">
            Find the place of the next QR / solve the riddle, then scan the QR for verification and type the given ACCESS CODE correctly to go to the next stage.
          </p>
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
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Your Word Fragment</p>
                  <div className="min-h-[4.5rem] flex items-center justify-center px-2">
                    <p className="text-3xl font-bold text-amber-800 tracking-wide leading-tight text-center break-words max-w-full">
                      {content.wordFragment}
                    </p>
                  </div>
                  <p className="text-xs text-amber-600 mt-2">Remember this — you will need it at the Final Boss stage!</p>
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
