'use client';
/**
 * /qr/scan/[stage] — Full stage page: QR scan → access code → puzzle/hint/fragment
 *
 * Flow:
 *  1. Verify auth + current_stage matches URL
 *  2. Fetch stage content (puzzle, hint, word fragment)
 *  3. Show camera — scan the QR for this stage
 *  4. Correct QR → show access code input + puzzle/hint/fragment below
 *  5. Correct code → advance to /qr/scan/[next] or /congratulations
 *
 * Camera: jsqr + native getUserMedia (no html5-qrcode DOM issues)
 * Navigation: router.push only, isNavigatingRef prevents false dropout
 * Dropout: beforeunload only (not tab switch / visibility change)
 */
import { useEffect, useRef, useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';
import SessionWarningBanner from '@/components/SessionWarningBanner';
import type { StageContentResponse } from '@/lib/types';

type Phase =
  | 'verifying'   // checking auth + fetching stage content
  | 'loading'     // camera starting
  | 'scanning'    // camera active, waiting for QR
  | 'code_entry'  // QR scanned, show access code + puzzle
  | 'submitting'  // submitting code to server
  | 'success'     // code accepted, redirecting
  | 'error'       // camera error
  | 'denied';     // camera permission denied

export default function QRScanPage() {
  const router = useRouter();
  const params = useParams<{ stage: string }>();
  const stageNumber = parseInt(params.stage, 10);

  const [phase, setPhase] = useState<Phase>('verifying');
  const [stageContent, setStageContent] = useState<StageContentResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [codeError, setCodeError] = useState('');
  // Incrementing starts/restarts the camera effect. 0 = not yet authorized.
  const [startTrigger, setStartTrigger] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const isNavigatingRef = useRef(false);
  const stageRef = useRef(stageNumber);
  stageRef.current = stageNumber;

  // ── 1. Auth check + stage content fetch ─────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('studentToken');
    if (!token) { router.replace('/register'); return; }
    if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 5) {
      router.replace('/register'); return;
    }

    async function verify() {
      try {
        // Fetch both in parallel
        const [meRes, stageRes] = await Promise.all([
          fetch(`/api/student/me?_t=${Date.now()}`, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
          }),
          fetch(`/api/student/stage/${stageNumber}?_t=${Date.now()}`, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
          }),
        ]);

        const me = meRes.ok ? await meRes.json() : null;

        if (!me || me.status === 'cancelled') { router.replace('/register'); return; }
        if (me.currentStage >= 6 || me.status === 'completed') {
          isNavigatingRef.current = true;
          router.replace('/congratulations');
          return;
        }
        if (me.currentStage !== stageNumber) {
          // Wrong stage URL — redirect to correct QR scan page
          isNavigatingRef.current = true;
          router.replace(`/qr/scan/${me.currentStage}`);
          return;
        }

        // Load stage content (puzzle, hint, word fragment)
        if (stageRes.ok) {
          const content: StageContentResponse = await stageRes.json();
          setStageContent(content);
        }

        // Auth passed — start camera
        setStartTrigger(1);
      } catch {
        // Network error — fail open (start camera without stage content)
        setStartTrigger(1);
      }
    }

    verify();

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

  // ── 2. Camera + QR decode loop ───────────────────────────────────────────────
  useEffect(() => {
    if (startTrigger === 0) return;

    let mounted = true;
    setPhase('loading');
    setErrorMsg('');

    async function startCamera() {
      try {
        // Tear down any previous stream
        cancelAnimationFrame(rafRef.current);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        if (!mounted) return;
        setPhase('scanning');

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
              // ✅ Correct QR — stop camera, show access code entry
              mounted = false;
              cancelAnimationFrame(rafRef.current);
              streamRef.current?.getTracks().forEach((t) => t.stop());
              streamRef.current = null;
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
        const name = String(err?.name ?? '').toLowerCase();
        const msg  = String(err?.message ?? '').toLowerCase();
        if (name.includes('notallowed') || msg.includes('permission') || msg.includes('denied')) {
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

  // ── 3. Submit access code ────────────────────────────────────────────────────
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

      // ✅ Success — navigate without triggering dropout
      isNavigatingRef.current = true;
      setPhase('success');

      setTimeout(() => {
        if (data.nextAction?.type === 'scan_qr') {
          router.push(`/qr/scan/${data.nextAction.nextStage}`);
        } else {
          router.push('/congratulations');
        }
      }, 900);
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

  // ── UI helpers ───────────────────────────────────────────────────────────────
  const stageLabels = ['', 'Binary Decoder', 'Mirror Text', 'Password Challenge', 'Caesar Cipher', 'Final Boss 🏆'];
  const stageDiffs  = ['', 'Medium', 'Medium-Hard', 'Hard', 'Very Hard', 'Final Boss'];
  const diffColors: Record<string, string> = {
    Medium: 'bg-green-500/20 text-green-300',
    'Medium-Hard': 'bg-yellow-500/20 text-yellow-300',
    Hard: 'bg-orange-500/20 text-orange-300',
    'Very Hard': 'bg-red-500/20 text-red-300',
    'Final Boss 🏆': 'bg-purple-500/20 text-purple-300',
  };

  const isScanning = phase === 'loading' || phase === 'scanning';
  const showCodeEntry = phase === 'code_entry' || phase === 'submitting';

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <CollegeHeader />

      <main className="flex-1 flex flex-col items-center px-4 py-6 gap-5 max-w-lg mx-auto w-full">

        {/* ── VERIFYING ── */}
        {phase === 'verifying' && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400 text-sm">Loading stage…</p>
            </div>
          </div>
        )}

        {/* Stage header — shown after verifying */}
        {phase !== 'verifying' && (
          <div className="text-center w-full">
            <h2 className="text-2xl font-bold text-white">
              {showCodeEntry || phase === 'success'
                ? `🔑 Stage ${stageNumber} — Enter Code`
                : `📷 Stage ${stageNumber} — Scan QR`}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <p className="text-gray-400 text-sm">{stageLabels[stageNumber]}</p>
              {stageContent?.difficulty && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diffColors[stageContent.difficulty] ?? 'bg-gray-700 text-gray-300'}`}>
                  {stageContent.difficulty}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── CAMERA VIEW ── video always in DOM while scanning so refs stay valid */}
        <div className={isScanning ? 'relative w-full' : 'hidden'} aria-hidden={!isScanning}>
          <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg z-10 pointer-events-none" />
          <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg z-10 pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg z-10 pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg z-10 pointer-events-none" />
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full rounded-2xl bg-black shadow-2xl"
            style={{ minHeight: '280px', objectFit: 'cover' }}
          />
          <canvas ref={canvasRef} className="hidden" />
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
          <div className="flex items-center gap-2 w-full justify-center">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <p className="text-green-400 text-sm">Camera active — hold QR #{stageNumber} in frame</p>
          </div>
        )}

        {/* Wrong QR error (camera still running) */}
        {isScanning && errorMsg && (
          <div className="w-full bg-red-900/40 border border-red-700 rounded-2xl p-4 text-center space-y-3">
            <p className="text-red-300 text-sm">{errorMsg}</p>
            <button onClick={retryScanner} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
              🔄 Try Again
            </button>
          </div>
        )}

        {/* ── CAMERA ERROR ── */}
        {phase === 'error' && (
          <div className="w-full bg-red-900/40 border border-red-700 rounded-2xl p-5 text-center space-y-3">
            <p className="text-4xl">⚠️</p>
            <p className="text-red-300 text-sm">{errorMsg}</p>
            <button onClick={retryScanner} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
              🔄 Try Again
            </button>
          </div>
        )}

        {/* ── CAMERA DENIED ── */}
        {phase === 'denied' && (
          <div className="w-full bg-red-900/40 border border-red-700 rounded-2xl p-5 text-center space-y-3">
            <p className="text-4xl">📵</p>
            <p className="text-red-300 text-sm">{errorMsg}</p>
            <p className="text-gray-500 text-xs">Chrome: tap 🔒 → Camera → Allow → reload.</p>
            <button onClick={() => window.location.reload()} className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-xl text-sm transition-colors">
              Reload Page
            </button>
          </div>
        )}

        {/* ── ACCESS CODE + PUZZLE ── */}
        {showCodeEntry && (
          <div className="w-full space-y-4">
            {/* QR confirmed banner */}
            <div className="bg-green-900/30 border border-green-700 rounded-2xl p-4 text-center">
              <p className="text-green-400 font-semibold">✅ QR #{stageNumber} Scanned!</p>
              <p className="text-green-300 text-sm mt-1">Enter the 6-character access code shown at this station.</p>
            </div>

            {/* Access code form */}
            <form onSubmit={handleSubmitCode} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">Access Code</label>
                <input
                  type="text"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoFocus
                  value={accessCode}
                  onChange={(e) => { setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setCodeError(''); }}
                  disabled={phase === 'submitting'}
                  className="w-full bg-gray-800 border border-gray-600 rounded-2xl px-4 py-4 text-white text-3xl font-mono tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="XXXXXX"
                />
                {codeError && <p className="text-red-400 text-sm mt-2 text-center">{codeError}</p>}
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

            {/* Puzzle + hint + word fragment */}
            {stageContent && (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Puzzle</p>
                  <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{stageContent.puzzleText}</p>
                </div>

                {stageContent.hintText && stageNumber < 5 && (
                  <div className="border-t border-gray-700 pt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Hint</p>
                    <p className="text-blue-300 text-sm italic">{stageContent.hintText}</p>
                  </div>
                )}

                {stageContent.wordFragment && stageNumber < 5 && (
                  <div className="border-t border-gray-700 pt-3">
                    <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-2">Your Word Fragment</p>
                    <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 flex items-center justify-center min-h-[4rem]">
                      <p className="text-3xl font-bold text-amber-300 tracking-wide text-center break-words font-mono">
                        {stageContent.wordFragment}
                      </p>
                    </div>
                    <p className="text-xs text-amber-600 mt-2 text-center">
                      Remember this — you will need it at the Final Boss stage!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SUCCESS ── */}
        {phase === 'success' && (
          <div className="w-full bg-green-900/40 border border-green-700 rounded-2xl p-6 text-center space-y-3">
            <div className="text-5xl">🎉</div>
            <p className="text-green-300 font-bold text-lg">Stage {stageNumber} Complete!</p>
            <p className="text-green-400 text-sm">
              {stageNumber < 5 ? `Heading to Stage ${stageNumber + 1}…` : 'Heading to congratulations…'}
            </p>
            <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* Hint strip while scanning */}
        {phase === 'scanning' && !errorMsg && (
          <div className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
            <p className="text-gray-400 text-xs">
              💡 Point camera at QR #{stageNumber} — make sure it&apos;s well-lit and fills the frame
            </p>
          </div>
        )}

        {/* Show puzzle while scanning (so students can read the clue while searching for QR) */}
        {phase === 'scanning' && stageContent && (
          <div className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Stage {stageNumber} Puzzle</p>
              <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{stageContent.puzzleText}</p>
            </div>
            {stageContent.hintText && stageNumber < 5 && (
              <div className="border-t border-gray-700 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Hint</p>
                <p className="text-blue-300 text-sm italic">{stageContent.hintText}</p>
              </div>
            )}
            {stageContent.wordFragment && stageNumber < 5 && (
              <div className="border-t border-gray-700 pt-3">
                <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-2">Your Word Fragment</p>
                <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-3 flex items-center justify-center">
                  <p className="text-2xl font-bold text-amber-300 tracking-wide font-mono">{stageContent.wordFragment}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <SessionWarningBanner />
    </div>
  );
}
