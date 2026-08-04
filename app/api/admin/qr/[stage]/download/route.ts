import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { stages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { stage: string } }) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  const stageNumber = parseInt(params.stage, 10);
  if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 5) {
    return NextResponse.json({ error: 'Invalid stage.' }, { status: 400 });
  }

  const rows = await db.select().from(stages).where(eq(stages.stage_number, stageNumber)).limit(1);
  const row = rows[0];
  if (!row?.styled_qr_card_png) return NextResponse.json({ error: 'QR not generated yet.' }, { status: 404 });

  return new NextResponse(new Uint8Array(row.styled_qr_card_png), {
    headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="stage-${stageNumber}-qr.png"` },
  });
}
