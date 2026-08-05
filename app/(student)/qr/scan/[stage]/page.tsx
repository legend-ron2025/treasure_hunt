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
  const noDetectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    setStatus('starting');

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
              qr.stop().catch(() => {}).finally(() => {
                router.push(`/stage/${stageNumber}`);
              });
            } else {
              setStatus('mismatch');
              setError('Wrong QR code. Please find the correct one.');
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
      html5QrCodeRef.current?.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageNumber]);

  function handleRetry() {
    // Stop existing scanner and restart
    html5QrCodeRef.current?.stop().catch(() => {});
    setError(null);
    setStatus('idle');
    matchedRef.current = false;
    if (noDetectTimerRef.current) clearTimeout(noDetectTimerRef.current);
    // Re-mount by navigating to same page
    window.location.reload();
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
