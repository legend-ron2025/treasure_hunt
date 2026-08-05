'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Check event status first
    fetch('/api/time')
      .then((r) => r.ok ? r.json() : { eventStatus: 'before' })
      .then((timeData) => {
        if (timeData.eventStatus !== 'active') {
          router.replace('/countdown');
          return;
        }
        // Check for active student session
        const token = typeof window !== 'undefined' ? localStorage.getItem('studentToken') : null;
        if (!token) { router.replace('/register'); return; }
        fetch('/api/student/me', { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.ok ? r.json() : null)
          .then((me) => {
            if (!me || me.status === 'cancelled') { router.replace('/register'); return; }
            if (me.currentStage >= 6 || me.status === 'completed') { router.replace('/congratulations'); return; }
            router.replace(`/stage/${me.currentStage}`);
          })
          .catch(() => router.replace('/register'));
      })
      .catch(() => router.replace('/countdown'));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500 animate-pulse">Loading…</p>
    </div>
  );
}
