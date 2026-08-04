import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { stages, registrationQr } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  const allStages = await db.select().from(stages);
  const regQr = await db.select().from(registrationQr).limit(1);

  const qrCodes = [
    {
      type: 'registration',
      stageNumber: null,
      encodedUrl: regQr[0]?.qr_url ?? '/register',
      hasImage: !!regQr[0]?.styled_qr_png,
      accessCode: null,
      wordFragment: null,
      updatedAt: regQr[0]?.updated_at?.toISOString() ?? null,
    },
    ...allStages.map((s) => ({
      type: 'puzzle',
      stageNumber: s.stage_number,
      encodedUrl: s.qr_url,
      hasImage: !!s.styled_qr_card_png,
      accessCode: s.access_code,
      wordFragment: s.word_fragment ?? null,
      updatedAt: s.updated_at.toISOString(),
    })),
  ];

  return NextResponse.json({ qrCodes });
}
