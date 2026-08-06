'use client';
/**
 * QR Scan + Access Code page — uses jsqr + native getUserMedia.
 *
 * Why not html5-qrcode:
 *   It manipulates a DOM node by ID outside React, which conflicts with
 *   React 18 Strict Mode's double-invocation and causes "element already in use"
 *   errors and camera-stuck-on-loading bugs.
 *
 * This implementation:
 *   - Uses a <video ref> + canvas + requestAnimationFrame — fully React-controlled
 *   - jsqr decodes frames client-side with no external DOM manipulation
 *   - One useEffect for auth; one useEffect for camera (keyed off startTrigger)
 *   - Dropout only on actual browser close (beforeunload)
 */
import { useEffect, useRef, useState, useCallback, FormEvent } from 'react';
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
  // Incrementing this kicks the camera useEffect to (re)start.
  // 0 = auth not done yet; >0 = start / retry.
  const [startTrigger, setStartTrigger] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const isNavigatingRef = useRef(false);
  const stageRef = useRef(stageNumber);
  stageRef.current = stageNumber;

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
        // Auth passed — start camera
        setStartTrigger(1);
      })
      .catch(() => {
        // Network error — fail open
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

  // ── Camera + QR scan loop ───────────────────────────────────────────────────
  useEffect(() => {
    if (startTrigger === 0) return;

    let mounted = true;

    setPhase('loading');
    setErrorMsg('');

    async function startCamera() {
      try {
        // Stop any existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        cancelAnimationFrame(rafRef.current);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }

        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        if (!mounted) return;
        setPhase('scanning');

        // Decode loop using jsqr
        const jsQR = (await import('jsqr')).default;

        const tick = () => {
          if (!mounted) return;
          const vid = videoRef.current;
          const canvas = canvasRef.current;
          if (!vid || !canvas || vid.readyState < vid.HAVE_ENOUGH_DATA) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          const w = vid.videoWidth;
          const h = vid.videoHeight;
          if (w === 0 || h === 0) { rafRef.current = requestAnimationFrame(tick); return; }

          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(vid, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });

          if (code) {
            let path = '';
            try { path = new URL(code.data).pathname; } catch { path = code.data.trim(); }
            path = path.replace(/\/$/, '');
            const expected = `/stage/${stageRef.current}`;

            if (path === expected || path.endsWith(expected)) {
              // Correct QR — stop camera, show code entry
              mounted = false;
              cancelAnimationFrame(rafRef.current);
              if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
              }
              setPhase('code_entry');
              setErrorMsg('');
              return;
            } else {
              setErrorMsg(`Wrong QR. Please scan QR #${stageRef.current}.`);
            }
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch (err: any) {
        if (!mounted) return;
        const msg = String(err?.name ?? err?.message ?? '').toLowerCase();
        if (
          msg.includes('notallowederror') ||
          msg.includes('permissiondenied') ||
          msg.includes('permission') ||
          msg.includes('denied')
        ) {
          setPhase('denied');
          setErrorMsg('Camera access denied. Allow camera in your browser settings, then reload.');
        } else {
          setPhase('error');
          setErrorMsg(`Camera error: ${err?.message ?? 'Could not start'}. Tap Try Again.`);
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [startTrigger]);

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
    setStartTrigger((n) => n + 1);
  }

  const stageLabels = ['', 'Binary Decoder', 'Mirror Text', 'Password Challenge', 'Caesar Cipher', 'Final Boss 🏆'];
  const stageDiffs  = ['', 'Medium', 'Medium-Hard', 'Hard', 'Very Hard', 'Final Boss'];
  const isScanning  = phase === 'loading' || phase === 'scanning';

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
              {stageLabels[stageNumber]} ·{' '}
              <span className="text-blue-400">{stageDiffs[stageNumber]}</span>
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

        {/* ── CAMERA VIEW ── always rendered when scanning so refs are stable */}
        <div className={isScanning ? 'relative w-full' : 'hidden'}>
          {/* Corner decorators */}
          <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg z-10 pointer-events-none" />
          <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg z-10 pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg z-10 pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg z-10 pointer-events-none" />

          {/* Live video feed */}
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full rounded-2xl bg-black shadow-2xl"
            style={{ minHeight: '300px', objectFit: 'cover' }}
          />
          {/* Hidden canvas for frame decoding */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Loading overlay */}
          {phase === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-2xl">
              <div className="text-center space-y-2">
                <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-blue-300 text-sm">Starting camera…</p>
              </div>
            </div>
          )}
        </div>

        {/* Scan status */}
        {phase === 'scanning' && !errorMsg && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <p className="text-green-400 text-sm">Camera active — hold QR in frame</p>
          </div>
        )}

        {/* Wrong QR / no-detect error */}
        {isScanning && errorMsg && (
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
            <p className="text-gray-500 text-xs">
              Chrome: tap 🔒 → Camera → Allow, then reload.
            </p>
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
                  ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Checking…
                    </>
                  )
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
