import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { registrationQr } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  const rows = await db.select().from(registrationQr).limit(1);
  const row = rows[0];
  if (!row?.styled_qr_png) return NextResponse.json({ error: 'QR not generated yet.' }, { status: 404 });

  return new NextResponse(new Uint8Array(row.styled_qr_png), {
    headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="registration-qr.png"' },
  });
}
