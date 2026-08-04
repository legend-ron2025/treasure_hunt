import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { stages, registrationQr } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateQrCard } from '@/lib/services/qr.service';

export const dynamic = 'force-dynamic';

const COLLEGE_NAME = 'RJMMsVishwakamal Mahavidhayal';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? '';

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  const errors: string[] = [];

  // Generate registration QR
  try {
    const url = `${BASE_URL}/register`;
    const card = await generateQrCard(url, { collegeName: COLLEGE_NAME, label: 'Scan to Register' });
    await db.update(registrationQr).set({ styled_qr_png: card, qr_url: url, updated_at: new Date() }).where(eq(registrationQr.id, 1));
  } catch (e: any) {
    errors.push(`Registration QR: ${e.message}`);
  }

  // Generate puzzle QRs 1-5
  const allStages = await db.select().from(stages);
  for (const s of allStages) {
    try {
      const url = `${BASE_URL}/stage/${s.stage_number}`;
      const card = await generateQrCard(url, {
        collegeName: COLLEGE_NAME,
        accessCode: s.access_code,
        wordFragment: s.word_fragment ?? undefined,
      });
      await db.update(stages).set({ styled_qr_card_png: card, qr_url: url, updated_at: new Date() }).where(eq(stages.stage_number, s.stage_number));
    } catch (e: any) {
      errors.push(`Stage ${s.stage_number} QR: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ generated: 6 - errors.length, errors }, { status: 207 });
  }
  return NextResponse.json({ generated: 6 });
}
