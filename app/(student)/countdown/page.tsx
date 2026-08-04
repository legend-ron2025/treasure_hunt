'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';
import SessionWarningBanner from '@/components/SessionWarningBanner';
import type { ServerTimeResponse } from '@/lib/types';

interface TimeLeft { days: number; hours: number; minutes: number; seconds: number; }

function calcTimeLeft(targetMs: number, nowMs: number): TimeLeft {
  const diff = Math.max(0, targetMs - nowMs);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

export default function CountdownPage() {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [status, setStatus] = useState<'loading' | 'before' | 'active' | 'ended' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const startMsRef = useRef<number | null>(null);
  const serverOffsetRef = useRef(0); // client drift correction
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchServerTime() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/time', { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('Server error');
      const data: ServerTimeResponse = await res.json();
      const clientNow = Date.now();
      const serverNow = new Date(data.serverTime).getTime();
      serverOffsetRef.current = serverNow - clientNow;

      if (data.eventStatus === 'active') {
        setStatus('active');
        router.replace('/register');
        return;
      }
      if (data.eventStatus === 'ended') {
        setStatus('ended');
        setMessage('The event has ended. Thank you for participating!');
        return;
      }
      // 'before'
      if (!data.startTime) {
        setStatus('before');
        setMessage('The event has not been scheduled yet. Please check back later.');
        return;
      }
      startMsRef.current = new Date(data.startTime).getTime();
      setStatus('before');
    } catch {
      setStatus('error');
      setMessage('Could not connect to the server. Please check your connection and refresh.');
    }
  }

  useEffect(() => {
    fetchServerTime();
    // Re-sync every 60 seconds
    const syncInterval = setInterval(fetchServerTime, 60_000);
    return () => clearInterval(syncInterval);
  }, []);

  // Tick every second
  useEffect(() => {
    if (status !== 'before' || startMsRef.current === null) return;
    tickRef.current = setInterval(() => {
      const now = Date.now() + serverOffsetRef.current;
      const tl = calcTimeLeft(startMsRef.current!, now);
      setTimeLeft(tl);
      if (tl.days === 0 && tl.hours === 0 && tl.minutes === 0 && tl.seconds === 0) {
        clearInterval(tickRef.current!);
        fetchServerTime(); // re-check — may now be active
      }
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [status]);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <CollegeHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-6 text-center space-y-5">
          {status === 'loading' && <p className="text-gray-500">Checking event status…</p>}

          {status === 'error' && (
            <>
              <div className="text-4xl" aria-hidden="true">⚠️</div>
              <p className="text-red-700 text-sm">{message}</p>
            </>
          )}

          {status === 'ended' && (
            <>
              <div className="text-4xl" aria-hidden="true">🏁</div>
              <h2 className="text-xl font-bold text-gray-800">Event Ended</h2>
              <p className="text-gray-600 text-sm">{message}</p>
            </>
          )}

          {status === 'before' && !timeLeft && (
            <p className="text-gray-600 text-sm">{message || 'Calculating countdown…'}</p>
          )}

          {status === 'before' && timeLeft && (
            <>
              <h2 className="text-xl font-bold text-gray-800">Event Starting In</h2>
              <div className="grid grid-cols-4 gap-2 mt-2" aria-live="polite" aria-label="Countdown timer">
                {[
                  { label: 'Days', value: timeLeft.days },
                  { label: 'Hours', value: timeLeft.hours },
                  { label: 'Mins', value: timeLeft.minutes },
                  { label: 'Secs', value: timeLeft.seconds },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-blue-50 rounded-lg p-2">
                    <p className="text-2xl font-bold text-blue-700 font-mono">{pad(value)}</p>
                    <p className="text-xs text-blue-500">{label}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <SessionWarningBanner />
    </div>
  );
}
