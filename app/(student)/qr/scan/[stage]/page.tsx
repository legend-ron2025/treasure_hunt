'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CollegeHeader from '@/components/CollegeHeader';
import SessionWarningBanner from '@/components/SessionWarningBanner';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? '';

export default function QRScanPage() {
  const router = useRouter();
  const params = useParams<{ stage: string }>();
  const stageNumber = parseInt(params.stage, 10);
  const expectedUrl = `${BASE_URL}/stage/${stageNumber}`;

  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'mismatch'>('idle');
  const noDetectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('studentToken');
    if (!token) { router.replace('/register'); return; }

    let html5QrCode: any;

    async function startScanner() {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode');
        html5QrCode = new Html5QrcodeScanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          false,
        );

        setStatus('scanning');

        // 60-second no-detect prompt
        noDetectTimerRef.current = setTimeout(() => {
          setError('No QR code detected. Please reposition the camera and try again.');
        }, 60_000);

        html5QrCode.render(
          (decodedText: string) => {
            if (noDetectTimerRef.current) clearTimeout(noDetectTimerRef.current);
            // Normalize URLs for comparison
            const normalised = decodedText.trim().replace(/\/$/, '');
            const normExpected = expectedUrl.trim().replace(/\/$/, '');
            // Accept if decoded matches expected path
            if (normalised === normExpected || normalised.endsWith(`/stage/${stageNumber}`)) {
              html5QrCode.clear().catch(() => {});
              router.push(`/stage/${stageNumber}`);
            } else {
              setStatus('mismatch');
              setError('Wrong QR code. Please find the correct one.');
            }
          },
          () => { /* scan error — ignore individual frame failures */ },
        );
      } catch {
        setError('Camera access is required to scan QR codes. Please allow camera access and try again.');
      }
    }

    startScanner();

    return () => {
      if (noDetectTimerRef.current) clearTimeout(noDetectTimerRef.current);
      try { html5QrCode?.clear(); } catch { /* ignore */ }
    };
  }, [router, stageNumber, expectedUrl]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <CollegeHeader />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 space-y-5">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">Scan QR {stageNumber}</h2>
          <p className="text-sm text-gray-500 mt-1">Find QR code {stageNumber} and point your camera at it</p>
        </div>

        <div id="qr-reader" ref={containerRef} className="w-full max-w-xs" />

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 max-w-xs w-full">
            <p className="text-sm text-red-700 text-center">{error}</p>
            {status === 'mismatch' && (
              <button
                onClick={() => { setError(null); setStatus('scanning'); }}
                className="mt-2 w-full text-sm text-red-600 underline"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </main>
      <SessionWarningBanner />
    </div>
  );
}
