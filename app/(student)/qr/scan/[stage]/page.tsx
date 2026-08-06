'use client';
/**
 * Combined QR Scan + Access Code page.
 *
 * Flow per stage:
 *  1. Auth check verifies student's current_stage matches this page's stage
 *  2. Camera starts — student scans the QR for this stage
 *  3. Correct QR decoded → hide camera, show access code input
 *  4a. Correct code → advance to /qr/scan/[next] or /congratulations
 *  4b. Wrong code  → show error, let student retry
 *
 * Key design:
 *  - `startTrigger` (number state) is incremented by auth check OR retry button.
 *    The scanner useEffect depends on [startTrigger] so it re-runs exactly when needed.
 *  - `phase` is NOT in scanner deps (adding it caused an infinite restart loop).
 *  - No window.location.href — only router.push (no beforeunload firing).
 *  - Dropout only on actual browser close (beforeunload), not tab switch.
 */
import { useEffect, useRef, useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';
import SessionWarningBanner from '@/components/SessionWarningBanner';

type Phase =
  | 'verifying'
  | 'loading'
  | 'scanning'
  | 'code_entry'
  | 'submitting'
  | 'success'
  | 'error'
  | 'denied';

export default function QRScanPage() {
  const router = useRouter();
  const params = useParams<{ stage: string }>();
  const stageNumber = parseInt(params.stage, 10);

  const [phase, setPhase] = useState<Phase>('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [codeError, setCodeError] = useState('');

  // Incrementing this triggers the scanner useEffect to (re)start the camera.
  // 0 = not started yet (auth hasn't cleared us). >0 = start/restart.
  const [startTrigger, setStartTrigger] = useState(0);

  const html5QrRef = useRef<any>(null);
  const isNavigatingRef = useRef(false);
  const noDetectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageNumberRef = useRef(stageNumber);
  stageNumberRef.current = stageNumber;

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('studentToken');
    if (!token) { router.replace('/register'); return; }
    if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 5) {
      router.replace('/register'); return;
    }

    fetch(`/api/student/me?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((me) => {
        if (!me || me.status === 'cancelled') { router.replace('/register'); return; }
        if (me.currentStage >= 6 || me.status === 'completed') {
          isNavigatingRef.current = true;
          router.replace('/congratulations');
          return;
        }
        if (me.currentStage !== stageNumber) {
          isNavigatingRef.current = true;
          router.replace(`/qr/scan/${me.currentStage}`);
          return;
        }
        // Stage matches — kick off scanner
        setPhase('loading');
        setStartTrigger(1);
      })
      .catch(() => {
        // Network error — fail open, start scanner anyway
        setPhase('loading');
        setStartTrigger(1);
      });

    function handleBeforeUnload() {
      if (isNavigatingRef.current) return;
      const t = localStorage.getItem('studentToken');
      if (!t) return;
      try {
        navigator.sendBeacon(
          '/api/student/dropout',
          new Blob([JSON.stringify({ token: t, reason: 'dropout_tab_close' })], {
            type: 'application/json',
          }),
        );
      } catch { /* ignore */ }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [router, stageNumber]);

  // ── Camera / QR scanner ─────────────────────────────────────────────────────
  // Depends on [startTrigger] only.
  // startTrigger=0  → effect runs on mount but exits immediately (camera not yet cleared by auth).
  // startTrigger>0  → auth has cleared us; start camera. Incrementing it on retry also works.
  useEffect(() => {
    if (startTrigger === 0) return;

    let mounted = true;

    setPhase('loading');
    setErrorMsg('');

    async function startCamera() {
      // Give React one frame to render the container div before html5-qrcode tries to attach
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      if (!mounted) return;

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;

        // Stop & clear any previous instance
        if (html5QrRef.current) {
          try { await html5QrRef.current.stop(); } catch { /* ignore */ }
          try { html5QrRef.current.clear(); } catch { /* ignore */ }
          html5QrRef.current = null;
        }

        const qrInstance = new Html5Qrcode('qr-video-container');
        html5QrRef.current = qrInstance;

        await qrInstance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          // Success callback — called each time a QR is decoded
          (decodedText: string) => {
            if (!mounted) return;

            if (noDetectTimerRef.current) {
              clearTimeout(noDetectTimerRef.current);
              noDetectTimerRef.current = null;
            }

            let path = '';
            try { path = new URL(decodedText).pathname; } catch { path = decodedText.trim(); }
            path = path.replace(/\/$/, '');
            const expected = `/stage/${stageNumberRef.current}`;

            if (path === expected || path.endsWith(expected)) {
              qrInstance.stop().catch(() => {});
              html5QrRef.current = null;
              setPhase('code_entry');
              setErrorMsg('');
            } else {
              setErrorMsg(`Wrong QR. Please scan QR #${stageNumberRef.current}.`);
            }
          },
          // Per-frame error — ignore
          () => {},
        );

        if (!mounted) return;

        setPhase('scanning');

        // After 60s with no scan, show a nudge
        noDetectTimerRef.current = setTimeout(() => {
          if (mounted) setErrorMsg("No QR detected. Move closer and ensure good lighting.");
        }, 60_000);
      } catch (err: any) {
        if (!mounted) return;
        const msg = String(err?.message ?? '').toLowerCase();
        if (msg.includes('permission') || msg.includes('notallowed') || msg.includes('denied')) {
          setPhase('denied');
          setErrorMsg('Camera access denied. Allow camera in browser settings, then reload.');
        } else {
          setPhase('error');
          setErrorMsg(`Camera error: ${err?.message ?? 'Could not start'}. Tap Try Again.`);
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (noDetectTimerRef.current) { clearTimeout(noDetectTimerRef.current); noDetectTimerRef.current = null; }
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
        html5QrRef.current = null;
      }
    };
  }, [startTrigger]); // only startTrigger — intentionally excludes phase

  // ── Submit access code ──────────────────────────────────────────────────────
  async function handleSubmitCode(e: FormEvent) {
    e.preventDefault();
    setCodeError('');
    const code = accessCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setCodeError('Access code must be exactly 6 alphanumeric characters.');
      return;
    }

    setPhase('submitting');
    const token = localStorage.getItem('studentToken');
    try {
      const res = await fetch(`/api/student/stage/${stageNumber}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accessCode: code }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setPhase('code_entry');
        setCodeError(data.error ?? 'Incorrect access code. Please try again.');
        return;
      }

      isNavigatingRef.current = true;
      setPhase('success');

      setTimeout(() => {
        if (data.nextAction?.type === 'scan_qr') {
          router.push(`/qr/scan/${data.nextAction.nextStage}`);
        } else {
          router.push('/congratulations');
        }
      }, 800);
    } catch {
      setPhase('code_entry');
      setCodeError('Network error. Please try again.');
    }
  }

  function retryScanner() {
    setErrorMsg('');
    setAccessCode('');
    setCodeError('');
    // Increment trigger → scanner useEffect re-runs and restarts camera
    setStartTrigger((n) => n + 1);
  }

  const stageLabels = ['', 'Binary Decoder', 'Mirror Text', 'Password Challenge', 'Caesar Cipher', 'Final Boss 🏆'];
  const stageDiffs  = ['', 'Medium', 'Medium-Hard', 'Hard', 'Very Hard', 'Final Boss'];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <CollegeHeader />

      <main className="flex-1 flex flex-col items-center px-4 py-6 gap-5 max-w-sm mx-auto w-full">

        {/* Stage header */}
        {phase !== 'verifying' && (
          <div className="text-center w-full">
            <h2 className="text-2xl font-bold text-white">
              {phase === 'code_entry' || phase === 'submitting' || phase === 'success'
                ? `🔑 Stage ${stageNumber} — Enter Code`
                : `📷 Stage ${stageNumber} — Scan QR`}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {stageLabels[stageNumber]} · <span className="text-blue-400">{stageDiffs[stageNumber]}</span>
            </p>
          </div>
        )}

        {/* ── VERIFYING ── */}
        {phase === 'verifying' && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400 text-sm">Verifying…</p>
            </div>
          </div>
        )}

        {/* ── CAMERA ── keep container in DOM while loading/scanning so html5-qrcode can attach */}
        {(phase === 'loading' || phase === 'scanning') && (
          <>
            <div className="relative w-full">
              <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg z-10 pointer-events-none" />
              <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg z-10 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg z-10 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg z-10 pointer-events-none" />

              {/* html5-qrcode injects <video> into this div */}
              <div
                id="qr-video-container"
                className="w-full rounded-2xl overflow-hidden bg-black shadow-2xl"
                style={{ minHeight: '300px' }}
              />

              {phase === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-2xl">
                  <div className="text-center space-y-2">
                    <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-blue-300 text-sm">Starting camera…</p>
                  </div>
                </div>
              )}
            </div>

            {phase === 'scanning' && !errorMsg && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <p className="text-green-400 text-sm">Camera active — hold QR in frame</p>
              </div>
            )}

            {errorMsg && (
              <div className="w-full bg-red-900/40 border border-red-700 rounded-2xl p-4 text-center space-y-3">
                <p className="text-red-300 text-sm">{errorMsg}</p>
                <button
                  onClick={retryScanner}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  🔄 Try Again
                </button>
              </div>
            )}
          </>
        )}

        {/* ── CAMERA ERROR ── */}
        {phase === 'error' && (
          <div className="w-full bg-red-900/40 border border-red-700 rounded-2xl p-5 text-center space-y-3">
            <p className="text-4xl">⚠️</p>
            <p className="text-red-300 text-sm">{errorMsg}</p>
            <button
              onClick={retryScanner}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              🔄 Try Again
            </button>
          </div>
        )}

        {/* ── CAMERA DENIED ── */}
        {phase === 'denied' && (
          <div className="w-full bg-red-900/40 border border-red-700 rounded-2xl p-5 text-center space-y-3">
            <p className="text-4xl">📵</p>
            <p className="text-red-300 text-sm">{errorMsg}</p>
            <p className="text-gray-500 text-xs">Chrome: tap 🔒 → Camera → Allow, then reload.</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-xl text-sm transition-colors"
            >
              Reload Page
            </button>
          </div>
        )}

        {/* ── ACCESS CODE ── */}
        {(phase === 'code_entry' || phase === 'submitting') && (
          <div className="w-full space-y-4">
            <div className="bg-green-900/30 border border-green-700 rounded-2xl p-4 text-center">
              <p className="text-green-400 font-semibold">✅ QR Scanned Successfully!</p>
              <p className="text-green-300 text-sm mt-1">
                Enter the 6-character access code shown at this station.
              </p>
            </div>

            <form onSubmit={handleSubmitCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  Access Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoFocus
                  value={accessCode}
                  onChange={(e) => {
                    setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                    setCodeError('');
                  }}
                  disabled={phase === 'submitting'}
                  className="w-full bg-gray-800 border border-gray-600 rounded-2xl px-4 py-4 text-white text-3xl font-mono tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="XXXXXX"
                />
                {codeError && (
                  <p className="text-red-400 text-sm mt-2 text-center">{codeError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={phase === 'submitting' || accessCode.length < 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl text-base font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {phase === 'submitting'
                  ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Checking…</>
                  : '🔓 Submit Code'}
              </button>

              <button
                type="button"
                onClick={retryScanner}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white py-2.5 rounded-2xl text-sm transition-colors"
              >
                ↩ Scan QR Again
              </button>
            </form>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {phase === 'success' && (
          <div className="w-full bg-green-900/40 border border-green-700 rounded-2xl p-6 text-center space-y-3">
            <div className="text-5xl">🎉</div>
            <p className="text-green-300 font-bold text-lg">Stage {stageNumber} Complete!</p>
            <p className="text-green-400 text-sm">Redirecting to next stage…</p>
            <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* Hint */}
        {phase === 'scanning' && !errorMsg && (
          <div className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
            <p className="text-gray-400 text-xs">
              💡 Make sure QR #{stageNumber} is well-lit and fills the frame
            </p>
          </div>
        )}
      </main>

      <SessionWarningBanner />
    </div>
  );
}
