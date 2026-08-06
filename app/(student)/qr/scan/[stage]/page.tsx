'use client';
/**
 * Combined QR Scan + Access Code page.
 *
 * Flow per stage:
 *  1. Auth check → verify student's current_stage matches this stage
 *  2. Show camera — student scans the QR for this stage
 *  3. QR decoded correctly → hide camera, show access code input
 *  4a. Correct → advance to next stage (/qr/scan/[next] or /congratulations)
 *  4b. Wrong → show error, let student retry
 *
 * Camera rules:
 *  - Camera only starts AFTER auth check passes (phase set to 'loading' by auth effect)
 *  - Scanner useEffect deps are [stageNumber, scannerKey] only — NOT phase
 *    (including phase caused an infinite restart loop: loading→scanning→effect reruns→cleanup→restart)
 *  - canStartRef gates the scanner so it only fires when auth has cleared it
 */
import { useEffect, useRef, useState, useCallback, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';
import SessionWarningBanner from '@/components/SessionWarningBanner';

type Phase = 'verifying' | 'loading' | 'scanning' | 'code_entry' | 'submitting' | 'success' | 'error' | 'denied';

export default function QRScanPage() {
  const router = useRouter();
  const params = useParams<{ stage: string }>();
  const stageNumber = parseInt(params.stage, 10);

  const [phase, setPhase] = useState<Phase>('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [scannerKey, setScannerKey] = useState(0);

  const html5QrRef = useRef<any>(null);
  const isNavigatingRef = useRef(false);
  const noDetectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Gate: scanner effect checks this before starting camera.
  // Auth effect sets it to true once stage is confirmed.
  const canStartRef = useRef(false);

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('studentToken');
    if (!token) { router.replace('/register'); return; }
    if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 5) {
      router.replace('/register'); return;
    }

    // Verify student's current_stage matches the requested stage
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
        } else {
          // Stage matches — allow scanner to start
          canStartRef.current = true;
          setPhase('loading');
        }
      })
      .catch(() => {
        // On network error, allow scanner to proceed (fail-open for UX)
        canStartRef.current = true;
        setPhase('loading');
      });

    // Dropout on actual browser close only
    function handleBeforeUnload() {
      if (isNavigatingRef.current) return;
      const t = localStorage.getItem('studentToken');
      if (!t) return;
      try {
        navigator.sendBeacon(
          '/api/student/dropout',
          new Blob([JSON.stringify({ token: t, reason: 'dropout_tab_close' })], { type: 'application/json' }),
        );
      } catch { /* ignore */ }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [router, stageNumber]);

  // ── Start scanner ────────────────────────────────────────────────────────────
  // IMPORTANT: 'phase' is intentionally NOT in the dependency array.
  // If phase were included, setPhase('scanning') inside would trigger cleanup+restart → infinite loop.
  // Instead we gate on canStartRef so the scanner only fires after auth clears it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!canStartRef.current) return;
    if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 5) return;

    let qr: any = null;
    let mounted = true;

    // Reset to loading state visually for retry
    setPhase('loading');
    setErrorMsg('');

    async function start() {
      // Small delay to let the DOM render the container before html5-qrcode attaches
      await new Promise((res) => setTimeout(res, 80));
      if (!mounted) return;

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;

        // Clean up any previous instance
        if (html5QrRef.current) {
          try { await html5QrRef.current.stop(); } catch { /* ignore */ }
          try { html5QrRef.current.clear(); } catch { /* ignore */ }
          html5QrRef.current = null;
        }

        qr = new Html5Qrcode('qr-video-container');
        html5QrRef.current = qr;

        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            if (!mounted) return;
            if (noDetectTimerRef.current) {
              clearTimeout(noDetectTimerRef.current);
              noDetectTimerRef.current = null;
            }

            // Check if scanned QR path matches /stage/{stageNumber}
            let path = '';
            try { path = new URL(decodedText).pathname; } catch { path = decodedText.trim(); }
            path = path.replace(/\/$/, '');
            const expected = `/stage/${stageNumber}`;

            if (path === expected || path.endsWith(expected)) {
              qr.stop().catch(() => {});
              html5QrRef.current = null;
              setPhase('code_entry');
              setErrorMsg('');
            } else {
              // Wrong QR — show error, keep scanning
              setErrorMsg(`Wrong QR code. Please find QR #${stageNumber} and scan it.`);
            }
          },
          () => { /* per-frame decode error — ignore */ },
        );

        if (mounted) {
          setPhase('scanning');
          // 60s no-detect hint
          noDetectTimerRef.current = setTimeout(() => {
            if (mounted) setErrorMsg("No QR detected. Move closer and make sure it's well lit.");
          }, 60_000);
        }
      } catch (err: any) {
        if (!mounted) return;
        const msg = String(err?.message ?? '').toLowerCase();
        if (msg.includes('permission') || msg.includes('notallowed') || msg.includes('denied')) {
          setPhase('denied');
          setErrorMsg('Camera access denied. Please allow camera access in your browser settings.');
        } else {
          setPhase('error');
          setErrorMsg(`Camera error: ${err?.message ?? 'Could not start camera'}. Try refreshing.`);
        }
      }
    }

    start();

    return () => {
      mounted = false;
      if (noDetectTimerRef.current) { clearTimeout(noDetectTimerRef.current); noDetectTimerRef.current = null; }
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
        html5QrRef.current = null;
      }
    };
  }, [stageNumber, scannerKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

      // Success — navigate without triggering beforeunload
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
    canStartRef.current = true;
    setScannerKey((k) => k + 1);
  }

  const stageLabels = ['', 'Binary Decoder', 'Mirror Text', 'Password Challenge', 'Caesar Cipher', 'Final Boss 🏆'];
  const stageDiffs  = ['', 'Medium', 'Medium-Hard', 'Hard', 'Very Hard', 'Final Boss'];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <CollegeHeader />

      <main className="flex-1 flex flex-col items-center px-4 py-6 gap-5 max-w-sm mx-auto w-full">

        {/* Stage header — hidden while verifying */}
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

        {/* ── VERIFYING AUTH ── */}
        {phase === 'verifying' && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400 text-sm">Verifying…</p>
            </div>
          </div>
        )}

        {/* ── SCANNING PHASE (camera container always in DOM when scanning) ── */}
        {(phase === 'loading' || phase === 'scanning') && (
          <>
            <div className="relative w-full">
              {/* Corner decorators */}
              <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg z-10 pointer-events-none" />
              <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg z-10 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg z-10 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg z-10 pointer-events-none" />
              {/* Camera container — html5-qrcode injects video into this div */}
              <div
                id="qr-video-container"
                className="w-full rounded-2xl overflow-hidden bg-black shadow-2xl"
                style={{ minHeight: '300px' }}
              />
              {/* Starting overlay */}
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
                <p className="text-green-400 text-sm">Camera active — hold QR code in frame</p>
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

        {/* ── ACCESS CODE ENTRY ── */}
        {(phase === 'code_entry' || phase === 'submitting') && (
          <div className="w-full space-y-4">
            <div className="bg-green-900/30 border border-green-700 rounded-2xl p-4 text-center">
              <p className="text-green-400 font-semibold">✅ QR Scanned Successfully!</p>
              <p className="text-green-300 text-sm mt-1">Now enter the 6-character access code shown at this station.</p>
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
              💡 Make sure QR #{stageNumber} is well-lit and fills the camera frame
            </p>
          </div>
        )}
      </main>

      <SessionWarningBanner />
    </div>
  );
}
