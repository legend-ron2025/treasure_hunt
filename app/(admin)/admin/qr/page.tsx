'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

type QrCode = {
  type: string;
  stageNumber: number | null;
  encodedUrl: string;
  hasImage: boolean;
  accessCode: string | null;
  wordFragment: string | null;
  updatedAt: string | null;
};

function getToken() {
  return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null;
}

/**
 * Downloads a file from a URL that requires Authorization header.
 * Uses fetch + createObjectURL so the auth token is sent properly.
 */
async function authDownload(apiUrl: string, token: string, filename: string) {
  const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `Download failed: HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
}

export default function QRManagement() {
  const router = useRouter();
  const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  async function load() {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    const res = await fetch('/api/admin/qr', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { router.replace('/admin/login'); return; }
    if (res.ok) {
      const d = await res.json();
      setQrCodes(d.qrCodes ?? []);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateAll() {
    setGenerating(true);
    setError('');
    setStatusMsg('Generating QR cards — this may take 30–60 seconds…');
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }

    try {
      const res = await fetch('/api/admin/qr/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      // Reload QR metadata after generation
      await load();

      if (res.ok) {
        setStatusMsg('✅ All QR cards generated! Downloading ZIP…');
        // Auto-download ZIP from server-side endpoint
        try {
          await authDownload('/api/admin/qr/download-all', token, 'NMIET-treasure-hunt-qr-codes.zip');
          setStatusMsg('✅ ZIP downloaded! Check your Downloads folder.');
        } catch (zipErr: any) {
          setStatusMsg('✅ QR cards generated. Click "Download ZIP" to save them.');
          console.error('ZIP download error:', zipErr);
        }
      } else if (res.status === 207) {
        const errList = (data.errors as string[])?.join('; ') ?? 'Some QRs failed';
        setStatusMsg(`⚠️ Partial success: ${errList}. Click "Download ZIP" for what was generated.`);
      } else {
        setError(data.error ?? 'Generation failed. Check server logs.');
        setStatusMsg('');
      }
    } catch (e: any) {
      setError(e.message ?? 'Network error during generation.');
      setStatusMsg('');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadZip() {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    setDownloading(true);
    setError('');
    try {
      await authDownload('/api/admin/qr/download-all', token, 'NMIET-treasure-hunt-qr-codes.zip');
    } catch (e: any) {
      setError(e.message ?? 'ZIP download failed.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleSingleDownload(qr: QrCode) {
    const token = getToken();
    if (!token) return;
    const apiUrl =
      qr.type === 'registration'
        ? '/api/admin/qr/registration/download'
        : `/api/admin/qr/${qr.stageNumber}/download`;
    const filename =
      qr.type === 'registration'
        ? 'registration-qr.svg'
        : `stage-${qr.stageNumber}-qr.svg`;
    try {
      await authDownload(apiUrl, token, filename);
    } catch (e: any) {
      setError(`Download failed: ${e.message}`);
    }
  }

  const anyGenerated = qrCodes.some((q) => q.hasImage);
  const allGenerated = qrCodes.length > 0 && qrCodes.every((q) => q.hasImage);
  const stageLabels: Record<number, string> = {
    1: 'Medium', 2: 'Medium-Hard', 3: 'Hard', 4: 'Very Hard', 5: 'Final Boss 🏆',
  };

  return (
    <AdminLayout
      title="QR Code Management"
      headerRight={
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={generateAll}
            disabled={generating || downloading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {generating
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</>
              : '⚙️ Generate All QRs'}
          </button>
          {anyGenerated && (
            <button
              onClick={handleDownloadZip}
              disabled={downloading || generating}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {downloading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Downloading…</>
                : '📦 Download All (ZIP)'}
            </button>
          )}
        </div>
      }
    >
      <div className="max-w-5xl space-y-5">
        {/* Error banner */}
        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 text-red-300 text-sm flex items-start gap-2">
            <span className="flex-shrink-0">❌</span>
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-200 text-xs">✕</button>
          </div>
        )}

        {/* Status banner */}
        {statusMsg && !error && (
          <div className="bg-blue-900/40 border border-blue-700 rounded-xl p-4 text-blue-300 text-sm">
            {statusMsg}
          </div>
        )}

        {/* Not generated warning */}
        {!allGenerated && qrCodes.length > 0 && !statusMsg && !error && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 text-amber-300 text-sm">
            ⚠️ Click <strong>Generate All QRs</strong> to create print-ready A4 cards. They will auto-download as a ZIP after generation.
          </div>
        )}

        {/* Info */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-xs text-gray-400 space-y-1">
          <p>🖨️ <strong className="text-gray-200">Print size:</strong> A4 · SVG format (scales to any print size without quality loss)</p>
          <p>📦 <strong className="text-gray-200">ZIP download:</strong> All 6 cards (1 registration + 5 puzzle) in one file</p>
          <p>🔒 <strong className="text-gray-200">QR validity:</strong> QR codes encode the live site URL — scanning outside the event window shows a countdown timer</p>
        </div>

        {/* QR grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {qrCodes.map((qr) => {
            const key = qr.type === 'registration' ? 'reg' : String(qr.stageNumber);
            return (
              <div key={key} className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-3 hover:border-gray-500 transition-colors">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white text-sm">
                    {qr.type === 'registration' ? '📋 Registration QR' : `🔍 Stage ${qr.stageNumber} QR`}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    qr.hasImage ? 'bg-green-900/60 text-green-300' : 'bg-gray-800 text-gray-500'
                  }`}>
                    {qr.hasImage ? '✓ Ready' : 'Not generated'}
                  </span>
                </div>

                {/* Difficulty */}
                {qr.stageNumber && (
                  <p className="text-xs text-gray-500">
                    Difficulty: <span className="text-gray-300">{stageLabels[qr.stageNumber] ?? '—'}</span>
                  </p>
                )}

                {/* Encoded URL */}
                <p className="text-xs text-gray-600 font-mono truncate" title={qr.encodedUrl}>
                  {qr.encodedUrl || '(not set)'}
                </p>

                {/* Access code */}
                {qr.accessCode && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Access Code:</span>
                    <span className="font-mono font-bold text-white bg-gray-800 px-2 py-0.5 rounded text-sm tracking-widest">
                      {qr.accessCode}
                    </span>
                  </div>
                )}

                {/* Word fragment */}
                {qr.wordFragment && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Word Fragment:</span>
                    <span className="font-mono font-bold text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded text-sm">
                      {qr.wordFragment}
                    </span>
                  </div>
                )}

                {/* Timestamp */}
                {qr.updatedAt && (
                  <p className="text-xs text-gray-600">
                    Generated: {new Date(qr.updatedAt).toLocaleString()}
                  </p>
                )}

                {/* Individual download */}
                {qr.hasImage ? (
                  <button
                    onClick={() => handleSingleDownload(qr)}
                    className="w-full text-center bg-blue-900/40 hover:bg-blue-900/70 border border-blue-700 text-blue-300 py-2 rounded-xl text-sm transition-colors font-medium"
                  >
                    ⬇ Download This Card
                  </button>
                ) : (
                  <div className="w-full text-center border border-gray-700 text-gray-600 py-2 rounded-xl text-sm">
                    Generate first to download
                  </div>
                )}
              </div>
            );
          })}

          {qrCodes.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-600">
              <p className="text-5xl mb-3">📱</p>
              <p className="text-sm">Loading QR status…</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
