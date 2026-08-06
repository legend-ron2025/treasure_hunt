'use client';
/**
 * /stage/[stage] — Puzzle page
 *
 * Flow:
 *  1. Show puzzle text, hint, word fragment for this stage
 *  2. Student reads puzzle, searches for the QR code physically
 *  3. "📷 Scan QR" button → /qr/scan/[stage]
 *  4. After access code verified on scan page → comes back to /stage/[next]
 *
 * Dropout rules:
 *  - beforeunload (browser close / tab close) → ban immediately
 *  - visibilitychange (minimize, switch tab, switch app) → ban immediately
 *  - Internal navigation (router.push) is safe: isNavigatingRef prevents false dropout
 */
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';
import SessionWarningBanner from '@/components/SessionWarningBanner';
import type { StageContentResponse } from '@/lib/types';

export default function StagePage() {
  const router = useRouter();
  const params = useParams<{ stage: string }>();
  const stageNumber = parseInt(params.stage, 10);

  const [content, setContent] = useState<StageContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 5) {
      router.replace('/register');
      return;
    }

    const token = localStorage.getItem('studentToken');
    if (!token) { router.replace('/register'); return; }

    // Check sessionStorage flag set by qr/scan page after successful submit
    // This lets us skip the stale DB read-after-write on Neon's connection pool
    const advancedTo = sessionStorage.getItem('advancedToStage');
    if (advancedTo && parseInt(advancedTo, 10) === stageNumber) {
      sessionStorage.removeItem('advancedToStage');
    }

    fetch(`/api/student/stage/${stageNumber}?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
    })
      .then(async (r) => {
        if (r.status === 403) {
          const d = await r.json();
          throw { redirect: true, msg: d.error };
        }
        if (!r.ok) throw new Error('Failed to load stage');
        return r.json();
      })
      .then((data: StageContentResponse) => { setContent(data); setLoading(false); })
      .catch((e) => {
        if (e?.redirect) {
          const t = localStorage.getItem('studentToken');
          if (t) {
            fetch(`/api/student/me?_t=${Date.now()}`, {
              cache: 'no-store',
              headers: { Authorization: `Bearer ${t}`, 'Cache-Control': 'no-cache' },
            })
              .then((r) => r.ok ? r.json() : null)
              .then((me) => {
                isNavigatingRef.current = true;
                if (!me || me.status === 'cancelled') { router.replace('/register'); return; }
                if (me.currentStage >= 6 || me.status === 'completed') { router.replace('/congratulations'); return; }
                if (me.currentStage !== stageNumber) {
                  router.replace(`/stage/${me.currentStage}`);
                } else {
                  window.location.reload();
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

    function safeSendBeacon(payload: object) {
      if (typeof navigator?.sendBeacon !== 'function') return;
      try {
        navigator.sendBeacon(
          '/api/student/dropout',
          new Blob([JSON.stringify(payload)], { type: 'application/json' }),
        );
      } catch { /* ignore */ }
    }

    function sendDropout(reason: 'dropout_tab_close' | 'dropout_navigation') {
      if (isNavigatingRef.current) return;
      const t = localStorage.getItem('studentToken');
      if (!t) return;
      safeSendBeacon({ token: t, reason });
    }

    // Heartbeat every 2 minutes
    const hb = setInterval(() => {
      const t = localStorage.getItem('studentToken');
      if (t && !document.hidden) safeSendBeacon({ token: t });
    }, 2 * 60 * 1000);

    // Ban on actual browser/tab close
    function handleBeforeUnload() { sendDropout('dropout_tab_close'); }

    // Ban on minimize / switch app / switch tab
    function handleVisibilityChange() {
      if (document.hidden) sendDropout('dropout_tab_close');
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(hb);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router, stageNumber]);

  function goToScan() {
    isNavigatingRef.current = true;
    router.push(`/qr/scan/${stageNumber}`);
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <CollegeHeader />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Loading stage…</p>
        </div>
      </main>
      <SessionWarningBanner />
    </div>
  );

  const diffColors: Record<string, string> = {
    Medium: 'bg-green-500/20 text-green-300 border-green-700',
    'Medium-Hard': 'bg-yellow-500/20 text-yellow-300 border-yellow-700',
    Hard: 'bg-orange-500/20 text-orange-300 border-orange-700',
    'Very Hard': 'bg-red-500/20 text-red-300 border-red-700',
    'Final Boss 🏆': 'bg-purple-500/20 text-purple-300 border-purple-700',
  };
  const diffClass = diffColors[content?.difficulty ?? ''] ?? 'bg-gray-700 text-gray-300 border-gray-600';

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <CollegeHeader />

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-5">

        {/* Stage header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-2xl font-bold text-white">Stage {stageNumber}</h2>
            <p className="text-gray-400 text-sm mt-0.5">Read the puzzle, find the QR, then scan it.</p>
          </div>
          {content?.difficulty && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${diffClass}`}>
              {content.difficulty}
            </span>
          )}
        </div>

        {/* Puzzle card */}
        {content && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🧩 Puzzle</p>
              <p className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">{content.puzzleText}</p>
            </div>

            {content.hintText && stageNumber < 5 && (
              <div className="border-t border-gray-700 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">💡 Hint</p>
                <p className="text-blue-300 text-sm italic">{content.hintText}</p>
              </div>
            )}

            {content.wordFragment && stageNumber < 5 && (
              <div className="border-t border-gray-700 pt-4">
                <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-2">🔤 Your Word Fragment</p>
                <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 flex items-center justify-center min-h-[4.5rem]">
                  <p className="text-3xl font-bold text-amber-300 tracking-widest text-center break-words font-mono">
                    {content.wordFragment}
                  </p>
                </div>
                <p className="text-xs text-amber-600 mt-2 text-center">
                  Remember this — you will need it at the Final Boss stage!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Scan QR button — main CTA */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={goToScan}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-4 rounded-2xl text-base font-bold transition-colors shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-3"
          >
            <span className="text-2xl">📷</span>
            Found the QR? Scan it now!
          </button>
          <p className="text-gray-500 text-xs text-center">
            Solve the puzzle above → find the QR code at the location → tap to scan
          </p>
        </div>

        {apiError && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4">
            <p className="text-red-300 text-sm">{apiError}</p>
          </div>
        )}
      </main>

      <SessionWarningBanner />
    </div>
  );
}
