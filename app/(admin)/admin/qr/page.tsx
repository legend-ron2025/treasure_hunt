'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type QrCode = { type: string; stageNumber: number | null; encodedUrl: string; hasImage: boolean; accessCode: string | null; wordFragment: string | null; updatedAt: string | null; };

export default function QRManagement() {
  const router = useRouter();
  const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null; }

  async function load() {
    const token = getToken();
    if (!token) { router.replace('/admin/login'); return; }
    const res = await fetch('/api/admin/qr', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setQrCodes(d.qrCodes); }
  }

  useEffect(() => { load(); }, []);

  async function generateAll() {
    setGenerating(true); setError('');
    const token = getToken();
    const res = await fetch('/api/admin/qr/generate', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok && res.status !== 207) setError(data.error ?? 'Generation failed.');
    else { await load(); }
    setGenerating(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-800 text-white px-4 py-3 flex gap-4 text-sm">
        <a href="/admin/dashboard" className="hover:text-blue-300">Dashboard</a>
        <a href="/admin/qr" className="text-blue-300">QR Codes</a>
      </nav>
      <main className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">QR Management</h1>
          <button onClick={generateAll} disabled={generating} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {generating ? 'Generating…' : 'Generate All'}
          </button>
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {qrCodes.map((qr) => (
            <div key={qr.type === 'registration' ? 'reg' : qr.stageNumber} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  {qr.type === 'registration' ? 'Registration QR' : `Stage ${qr.stageNumber} QR`}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${qr.hasImage ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {qr.hasImage ? 'Generated' : 'Not generated'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono break-all">{qr.encodedUrl}</p>
              {qr.accessCode && <p className="text-xs text-gray-600">Code: <span className="font-mono font-bold">{qr.accessCode}</span></p>}
              {qr.wordFragment && <p className="text-xs text-gray-600">Fragment: <span className="font-mono font-bold">{qr.wordFragment}</span></p>}
              {qr.hasImage && (
                <a
                  href={qr.type === 'registration' ? '/api/admin/qr/registration/download' : `/api/admin/qr/${qr.stageNumber}/download`}
                  className="block text-center bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded text-sm transition-colors"
                >
                  Download PNG
                </a>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
