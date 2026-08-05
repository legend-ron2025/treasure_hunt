'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';
import SessionWarningBanner from '@/components/SessionWarningBanner';

export default function QRScanPage() {
  const router = useRouter();
  const params = useParams<{ stage: string }>();
  const stageNumber = parseInt(params.stage, 10);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'mismatch' | 'denied' | 'matched'>('idle');
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [accessError, setAccessError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const noDetectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchedRef = useRef(false);
  const html5QrCodeRef = useRef<any>(null);

  function isCorrectQr(decoded: string): boolean {
    try {
      const path = new URL(decoded).pathname.replace(/\/$/, '');
      return path === `/stage/${stageNumber}`;
    } catch {
      return decoded.trim().replace(/\/$/, '') === `/stage/${stageNumber}`;
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('studentToken');
    if (!token) { router.replace('/register'); return; }
    if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 5) { router.replace('/register'); return; }

    // Redirect to canonical domain if this page was opened from an old/deleted deployment
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

    setStatus('starting');
    setError(null);

    function sendDropout(reason: 'dropout_tab_close' | 'dropout_navigation') {
      const token = localStorage.getItem('studentToken');
      if (!token) return;
      if (typeof navigator?.sendBeacon !== 'function') return;
      try {
        navigator.sendBeacon(
          '/api/student/dropout',
          new Blob([JSON.stringify({ token, reason })], { type: 'application/json' }),
        );
      } catch {
        // Ignore unsupported or failing beacon calls.
      }
    }

    function handleBeforeUnload() {
      sendDropout('dropout_tab_close');
    }

    function handleVisibilityChange() {
      const token = localStorage.getItem('studentToken');
      if (!token) return;
      if (document.hidden) {
        visibilityTimerRef.current = setTimeout(() => {
          sendDropout('dropout_navigation');
        }, 5000);
      } else if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current);
        visibilityTimerRef.current = null;
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const qr = new Html5Qrcode('qr-reader-element');
        html5QrCodeRef.current = qr;

        await qr.start(
          { facingMode: 'environment' }, // rear camera
          { fps: 15, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            if (matchedRef.current) return;

            if (noDetectTimerRef.current) {
              clearTimeout(noDetectTimerRef.current);
              noDetectTimerRef.current = null;
            }

            if (isCorrectQr(decodedText)) {
              matchedRef.current = true;
              setStatus('matched');
              setError(null);
              qr.stop().catch(() => {});
              setShowAccessModal(true);
            } else {
              setStatus('scanning');
              setError('Wrong QR code. Please scan the correct QR for this stage.');
            }
          },
          () => { /* per-frame error — ignore */ },
        );

        setStatus('scanning');

        // 60-second no-detect prompt
        noDetectTimerRef.current = setTimeout(() => {
          if (!matchedRef.current) {
            setError('No QR code detected. Try moving closer or improving the lighting.');
          }
        }, 60_000);

      } catch (err: any) {
        const msg = String(err?.message ?? err ?? '').toLowerCase();
        if (msg.includes('permission') || msg.includes('notallowed') || msg.includes('denied')) {
          setStatus('denied');
          setError('Camera access was denied. Please allow camera access in your browser settings and refresh the page.');
        } else if (msg.includes('notfound') || msg.includes('no camera')) {
          setStatus('denied');
          setError('No camera found on this device. Please use a phone with a camera.');
        } else {
          setError(`Camera error: ${err?.message ?? 'Could not start camera. Please refresh and try again.'}`);
        }
      }
    }

    startScanner();

    return () => {
      if (noDetectTimerRef.current) clearTimeout(noDetectTimerRef.current);
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
      html5QrCodeRef.current?.stop().catch(() => {});
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageNumber, scannerKey]);

  function handleRetry() {
    // Stop existing scanner and restart
    html5QrCodeRef.current?.stop().catch(() => {});
    if (noDetectTimerRef.current) {
      clearTimeout(noDetectTimerRef.current);
      noDetectTimerRef.current = null;
    }
    matchedRef.current = false;
    setError(null);
    setAccessCode('');
    setAccessError('');
    setShowAccessModal(false);
    setStatus('starting');
    setScannerKey((key) => key + 1);
  }

  async function verifyAccessCode() {
    setAccessError('');
    if (!/^[A-Za-z0-9]{6}$/.test(accessCode)) {
      setAccessError('Access code must be 6 alphanumeric characters.');
      return;
    }
    setVerifying(true);
    try {
      const token = localStorage.getItem('studentToken');
      const res = await fetch(`/api/student/stage/${stageNumber}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accessCode: accessCode.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const errorMessage = data.error ?? 'Access code is wrong. Please retry.';
        setAccessError(errorMessage);
        setShowAccessModal(false);
        setAccessCode('');
        setError('Access code is wrong. Please scan the QR again and retry.');
        setStatus('starting');
        matchedRef.current = false;
        setScannerKey((key) => key + 1);
        return;
      }

      try {
        if (data.nextAction?.type === 'scan_qr' && data.nextAction.nextStage) {
          await router.push(`/stage/${data.nextAction.nextStage}`);
          window.location.href = `${window.location.origin}/stage/${data.nextAction.nextStage}`;
          return;
        }
        if (data.nextAction?.type === 'congratulations') {
          await router.push('/congratulations');
          window.location.href = `${window.location.origin}/congratulations`;
          return;
        }
        if (data.nextAction?.type === 'goto_stage' && data.nextAction.nextStage) {
          await router.push(`/stage/${data.nextAction.nextStage}`);
          window.location.href = `${window.location.origin}/stage/${data.nextAction.nextStage}`;
          return;
        }
        await router.push(`/stage/${stageNumber}`);
        window.location.href = `${window.location.origin}/stage/${stageNumber}`;
      } catch {
        window.location.href = `${window.location.origin}/stage/${stageNumber}`;
      }
    } catch (err: any) {
      setAccessError('Network error. Please try again.');
      setShowAccessModal(false);
      setStatus('scanning');
      matchedRef.current = false;
      setTimeout(() => {
        if (html5QrCodeRef.current) {
          html5QrCodeRef.current.stop().catch(() => {});
        }
        window.location.reload();
      }, 200);
    } finally {
      setVerifying(false);
    }
  }

  const stageNames = ['', 'Binary Puzzle', 'Mirror Text', 'Password Challenge', 'Caesar Cipher', 'Final Boss 🏆'];
  const stageColors = ['', 'green', 'blue', 'yellow', 'orange', 'red'];

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <CollegeHeader />

      <main className="flex-1 flex flex-col items-center px-4 py-6 space-y-5">
        {/* Stage header */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl">📷</span>
            <h2 className="text-2xl font-bold text-white">Scan QR {stageNumber}</h2>
          </div>
          <p className="text-gray-400 text-sm">
            {stageNames[stageNumber] ?? ''} Stage
          </p>
          <p className="text-gray-500 text-xs">
            Find QR code #{stageNumber} at its location, then point your camera at it
          </p>
        </div>

        {/* Camera viewfinder */}
        <div className="relative w-full max-w-sm">
          {/* Corner decorations */}
          <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg z-10 pointer-events-none" />
          <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg z-10 pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg z-10 pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg z-10 pointer-events-none" />

          {/* Scanning line animation */}
          {status === 'scanning' && (
            <div className="absolute left-4 right-4 h-0.5 bg-blue-400 opacity-80 z-10 pointer-events-none"
              style={{ animation: 'scan-line 2s linear infinite', top: '50%' }} />
          )}

          {/* Camera element — html5-qrcode renders into this div */}
          <div
            id="qr-reader-element"
            className="w-full rounded-2xl overflow-hidden bg-black shadow-2xl"
            style={{ minHeight: '320px' }}
          />

          {/* Status overlay */}
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-2xl">
              <div className="text-center space-y-2">
                <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-blue-300 text-sm">Starting camera…</p>
              </div>
            </div>
          )}

          {status === 'matched' && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-900/80 rounded-2xl">
              <div className="text-center space-y-2">
                <div className="text-5xl animate-bounce">✅</div>
                <p className="text-green-300 font-bold">QR Matched!</p>
                <p className="text-green-200 text-sm">Loading stage…</p>
              </div>
            </div>
          )}
            {/* Access code modal shown after QR match */}
            {showAccessModal && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl z-20">
                <div className="w-full max-w-sm bg-white rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Enter Access Code</h3>
                  <p className="text-sm text-gray-600">Scan verified. Please enter the stage access code to continue.</p>
                  <input
                    value={accessCode}
                    onChange={(e) => { setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setAccessError(''); }}
                    maxLength={6}
                    className="w-full px-3 py-2 border rounded-lg text-center font-mono text-2xl tracking-widest focus:outline-none"
                    placeholder="XXXXXX"
                  />
                  {accessError && <p className="text-sm text-red-600">{accessError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleRetry}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={verifyAccessCode}
                      disabled={verifying}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
                    >
                      {verifying ? 'Checking…' : 'Submit'}
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Scanning status */}
        {status === 'scanning' && !error && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <p className="text-green-400 text-sm font-medium">Camera active — hold QR code in frame</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="w-full max-w-sm bg-red-900/50 border border-red-600 rounded-2xl p-4 text-center space-y-3">
            <p className="text-red-300 text-sm leading-relaxed">{error}</p>
            {status !== 'denied' && (
              <button
                onClick={handleRetry}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                🔄 Try Again
              </button>
            )}
            {status === 'denied' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">
                  On Chrome: tap the 🔒 lock icon → Site settings → Camera → Allow
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-xl text-sm transition-colors"
                >
                  Reload Page
                </button>
              </div>
            )}
          </div>
        )}

        {/* Hint */}
        <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs">
            💡 Make sure the QR code is well-lit and fills the camera frame
          </p>
        </div>
      </main>

      <SessionWarningBanner />

      <style jsx>{`
        @keyframes scan-line {
          0% { top: 10%; }
          50% { top: 90%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}
