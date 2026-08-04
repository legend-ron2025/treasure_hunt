import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { stages } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;
  const rows = await db.select().from(stages);
  return NextResponse.json(rows.map((s) => ({
    stageNumber: s.stage_number, difficulty: s.difficulty, puzzleText: s.puzzle_text,
    hintText: s.hint_text, wordFragment: s.word_fragment, accessCode: s.access_code,
    qrUrl: s.qr_url, updatedAt: s.updated_at.toISOString(),
  })));
}
