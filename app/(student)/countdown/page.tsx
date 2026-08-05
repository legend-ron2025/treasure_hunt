'use client';
/**
 * Countdown page — shown when a QR is scanned before the event starts.
 *
 * Key behaviors:
 * - Polls /api/time every 10s to pick up schedule changes quickly
 * - Listens for localStorage 'scheduleUpdated' from the admin schedule page
 * - When timer hits zero → redirects to /register immediately
 * - /register bounces back here if event still not active (safe loop)
 * - redirectedRef prevents double-redirect
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';
import type { ServerTimeResponse } from '@/lib/types';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(targetMs: number, serverAnchorMs: number, clientAnchorMs: number): TimeLeft {
  const clientElapsed = Date.now() - clientAnchorMs;
  const effectiveNow = serverAnchorMs + clientElapsed;
  const diff = Math.max(0, targetMs - effectiveNow);
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000)  / 60_000),
    seconds: Math.floor((diff % 60_000)     / 1_000),
  };
}

export default function CountdownPage() {
  const router = useRouter();

  // startMs as STATE — changing it triggers the tick useEffect to restart
  const [startMs,  setStartMs]  = useState<number | null>(null);
  const [status,   setStatus]   = useState<'loading' | 'before' | 'active' | 'ended' | 'error'>('loading');
  const [message,  setMessage]  = useState('');
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  // Server-time anchor refs (no re-render needed, just baseline for arithmetic)
  const serverAnchorMsRef = useRef<number>(Date.now());
  const clientAnchorMsRef = useRef<number>(Date.now());

  const tickRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectedRef = useRef(false);

  // ─── Safe redirect ─────────────────────────────────────────────────────────
  const doRedirect = useCallback(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    router.replace('/register');
  }, [router]);

  // ─── Fetch /api/time ───────────────────────────────────────────────────────
  const fetchServerTime = useCallback(async () => {
    try {
      const clientFetchTime = Date.now();
      const res = await fetch('/api/time', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: ServerTimeResponse = await res.json();

      // Update server-time anchor so tick stays accurate after re-syncs
      serverAnchorMsRef.current = new Date(data.serverTime).getTime();
      clientAnchorMsRef.current = clientFetchTime;

      if (data.eventStatus === 'active') {
        doRedirect();
        return;
      }

      if (data.eventStatus === 'ended') {
        setStatus('ended');
        setMessage('The event has ended. Thank you for participating!');
        return;
      }

      // 'before'
      if (!data.startTime) {
        setStartMs(null);
        setStatus('before');
        setMessage('The event has not been scheduled yet. Please check back later.');
        return;
      }

      const newStartMs = new Date(data.startTime).getTime();
      // Always update startMs — even if the admin changed the schedule
      setStartMs(newStartMs);
      setStatus('before');
      setMessage('');
    } catch {
      // On error keep existing state; only show error if still loading
      setStatus((prev) => (prev === 'loading' ? 'error' : prev));
      if (status === 'loading') {
        setMessage('Could not connect to the server. Please try again.');
      }
    }
  }, [doRedirect, status]);

  // ─── Initial fetch + storage listener ─────────────────────────────────────
  useEffect(() => {
    fetchServerTime();

    // When the admin saves a schedule from the same browser, pick it up instantly
    function onStorage(e: StorageEvent) {
      if (e.key === 'scheduleUpdated') fetchServerTime();
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 10-second polling — picks up schedule changes within 10s ─────────────
  useEffect(() => {
    const id = setInterval(fetchServerTime, 10_000);
    return () => clearInterval(id);
  }, [fetchServerTime]);

  // ─── Tick — restarts whenever startMs changes ──────────────────────────────
  useEffect(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }

    if (status !== 'before' || startMs === null) return;

    function tick() {
      const tl = calcTimeLeft(startMs!, serverAnchorMsRef.current, clientAnchorMsRef.current);
      setTimeLeft(tl);
      if (tl.days === 0 && tl.hours === 0 && tl.minutes === 0 && tl.seconds === 0) {
        doRedirect();
      }
    }

    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  }, [startMs, status, doRedirect]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const rules = [
    'Do not close the tab or navigate away once you begin the event.',
    'Solve the stage puzzle before scanning the QR for verification.',
    'Scan the next stage QR only after finding its location.',
    'Type the access code exactly as shown to move forward.',
    'Leaving the page may cancel your registration permanently.',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 flex flex-col">
      <CollegeHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-sm rounded-3xl shadow-2xl p-8 text-center space-y-6 border border-white/20">
          <div className="space-y-4 text-left">
            <h2 className="text-xl font-bold text-white">Rules for the Treasure Hunt</h2>
            <p className="text-blue-200 text-sm">Read these carefully before the start so you can proceed smoothly:</p>
            <ul className="space-y-3">
              {rules.map((rule, index) => (
                <li
                  key={rule}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-blue-50 transition hover:border-blue-300/40 hover:bg-blue-800/40"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">{index + 1}</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="h-px bg-white/10" />

          {status === 'loading' && (
            <div className="space-y-4">
              <div className="w-14 h-14 border-4 border-blue-300 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-blue-200 text-sm">Checking event status…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="text-5xl">⚠️</div>
              <p className="text-red-300 text-sm">{message}</p>
              <button
                onClick={() => fetchServerTime()}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-blue-700 transition-colors font-medium"
              >
                Retry
              </button>
            </div>
          )}

          {status === 'ended' && (
            <div className="space-y-4">
              <div className="text-6xl">🏁</div>
              <h2 className="text-2xl font-bold text-white">Event Ended</h2>
              <p className="text-blue-200 text-sm">{message}</p>
            </div>
          )}

          {status === 'before' && startMs === null && (
            <div className="space-y-4">
              <div className="text-5xl">🕐</div>
              <h2 className="text-xl font-bold text-white">Coming Soon</h2>
              <p className="text-blue-200 text-sm">
                {message || 'The event has not been scheduled yet. Please check back later.'}
              </p>
              <p className="text-blue-400 text-xs">This page refreshes automatically every 10 seconds.</p>
            </div>
          )}

          {status === 'before' && startMs !== null && (
            <div className="space-y-7">
              <div>
                <div className="text-5xl mb-3">🏆</div>
                <h2 className="text-3xl font-bold text-white">Treasure Hunt</h2>
                <p className="text-blue-300 text-sm mt-2 font-medium tracking-wide uppercase">Starting in</p>
              </div>

              <div className="grid grid-cols-4 gap-3" aria-live="polite" aria-label="Countdown timer">
                {[
                  { label: 'Days',  value: timeLeft?.days    ?? 0 },
                  { label: 'Hours', value: timeLeft?.hours   ?? 0 },
                  { label: 'Mins',  value: timeLeft?.minutes ?? 0 },
                  { label: 'Secs',  value: timeLeft?.seconds ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/20 backdrop-blur rounded-2xl p-3 border border-white/30 shadow-inner">
                    <p className="text-4xl font-extrabold text-white font-mono tabular-nums tracking-tight">
                      {pad(value)}
                    </p>
                    <p className="text-xs text-blue-300 mt-1 font-medium uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>

              <p className="text-blue-300 text-xs">
                You will be automatically redirected to registration when the event starts.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
