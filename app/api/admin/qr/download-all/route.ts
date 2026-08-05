/**
 * GET /api/admin/qr/download-all
 *
 * Streams all generated QR cards as a ZIP directly from the database.
 * Server-side only — no client-side JSZip needed, auth handled here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { stages, registrationQr } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/**
 * Normalise a bytea value returned by Neon's HTTP driver.
 * Neon can return bytea as:
 *   - Buffer (Node.js)
 *   - Uint8Array
 *   - A plain object with numeric keys (serialised Uint8Array over JSON)
 *   - null / undefined
 */
function toBuffer(val: unknown): Buffer | null {
  if (!val) return null;
  if (Buffer.isBuffer(val)) return val;
  if (val instanceof Uint8Array) return Buffer.from(val);
  // Neon sometimes returns { '0': 60, '1': 63, ... } over JSON
  if (typeof val === 'object') {
    try {
      const arr = Object.values(val as Record<string, number>);
      if (arr.length > 0 && typeof arr[0] === 'number') {
        return Buffer.from(arr as number[]);
      }
    } catch { /* fall through */ }
  }
  // Hex string (e.g. "\\x3c737667...")
  if (typeof val === 'string') {
    const hex = val.startsWith('\\x') ? val.slice(2) : val;
    try { return Buffer.from(hex, 'hex'); } catch { /* fall through */ }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const [regRows, allStages] = await Promise.all([
      db.select().from(registrationQr).limit(1),
      db.select().from(stages).orderBy(stages.stage_number),
    ]);

    const regRow = regRows[0];
    const files: { name: string; buf: Buffer }[] = [];

    // Registration QR
    if (regRow?.styled_qr_png) {
      const buf = toBuffer(regRow.styled_qr_png);
      if (buf && buf.length > 0) {
        const isSvg = buf[0] === 0x3C; // '<' = SVG
        files.push({ name: `registration-qr.${isSvg ? 'svg' : 'png'}`, buf });
      }
    }

    // Puzzle QRs 1–5
    for (const s of allStages) {
      if (!s.styled_qr_card_png) continue;
      const buf = toBuffer(s.styled_qr_card_png);
      if (buf && buf.length > 0) {
        const isSvg = buf[0] === 0x3C;
        files.push({ name: `stage-${s.stage_number}-qr.${isSvg ? 'svg' : 'png'}`, buf });
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No QR codes have been generated yet. Click "Generate All" first.' },
        { status: 404 },
      );
    }

    // Build ZIP using jszip
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const { name, buf } of files) {
      zip.file(name, buf);
    }
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="NMIET-treasure-hunt-qr-codes.zip"',
        'Content-Length': String(zipBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[GET /api/admin/qr/download-all]', err);
    return NextResponse.json({ error: err?.message ?? 'ZIP generation failed.' }, { status: 500 });
  }
}
