import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { updateStageContent } from '@/lib/services/stage.service';
import { updateStageRequestSchema } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: { stage: string } }) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  const stageNumber = parseInt(params.stage, 10);
  if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 5) {
    return NextResponse.json({ error: 'Invalid stage number.' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const parsed = updateStageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed.', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Validate hint required for stages 1-4
  if (stageNumber < 5 && (!parsed.data.hintText || parsed.data.hintText.trim().length === 0)) {
    return NextResponse.json({ error: 'Hint cannot be empty for this stage.' }, { status: 400 });
  }

  await updateStageContent(stageNumber, {
    puzzle_text: parsed.data.puzzleText,
    hint_text: parsed.data.hintText ?? null,
    word_fragment: parsed.data.wordFragment ?? null,
    access_code: parsed.data.accessCode,
  });

  return NextResponse.json({ updated: true });
}
