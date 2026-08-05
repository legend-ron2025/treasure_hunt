import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { stages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function toBuffer(val: unknown): Buffer | null {
  if (!val) return null;
  if (Buffer.isBuffer(val)) return val;
  if (val instanceof Uint8Array) return Buffer.from(val);
  if (typeof val === 'object') {
    try {
      const arr = Object.values(val as Record<string, number>);
      if (arr.length > 0 && typeof arr[0] === 'number') return Buffer.from(arr as number[]);
    } catch { /* fall through */ }
  }
  if (typeof val === 'string') {
    const hex = val.startsWith('\\x') ? val.slice(2) : val;
    try { return Buffer.from(hex, 'hex'); } catch { /* fall through */ }
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { stage: string } },
) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  const stageNumber = parseInt(params.stage, 10);
  if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 5) {
    return NextResponse.json({ error: 'Invalid stage.' }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(stages)
    .where(eq(stages.stage_number, stageNumber))
    .limit(1);
  const row = rows[0];

  const buf = toBuffer(row?.styled_qr_card_png);
  if (!buf || buf.length === 0) {
    return NextResponse.json({ error: 'QR not generated yet.' }, { status: 404 });
  }

  const isSvg = buf[0] === 0x3C;
  const ext = isSvg ? 'svg' : 'png';

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': isSvg ? 'image/svg+xml' : 'image/png',
      'Content-Disposition': `attachment; filename="stage-${stageNumber}-qr.${ext}"`,
      'Cache-Control': 'no-store',
    },
  });
}
