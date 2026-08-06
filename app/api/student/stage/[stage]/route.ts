/**
 * GET /api/student/stage/:stage
 *
 * Returns stage content (puzzle, hint, word fragment, difficulty).
 * NEVER returns the access code.
 * Enforces server-side stage authorization.
 *
 * Requirements: 4.3, 4.6, 4.7, 4.8, 5.8
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireStudentAuth, isAuthError } from '@/lib/studentAuth';
import { getParticipantById } from '@/lib/services/student.service';
import { getStageContent } from '@/lib/services/stage.service';
import type { StageContentResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { stage: string } },
) {
  const auth = await requireStudentAuth(request);
  if (isAuthError(auth)) return auth;

  const stageNumber = parseInt(params.stage, 10);
  if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 5) {
    return NextResponse.json({ error: 'Invalid stage number.' }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const participant = await getParticipantById(auth.participantId);
  if (!participant) {
    return NextResponse.json({ error: 'Participant not found.' }, { status: 404, headers: NO_CACHE_HEADERS });
  }
  if (participant.status === 'cancelled') {
    return NextResponse.json(
      { error: 'Your registration was cancelled. You cannot re-register.' },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }

  // Stage authorization (Req 4.6, 4.7, 4.8)
  if (stageNumber > participant.current_stage) {
    return NextResponse.json(
      { error: 'Please complete your current stage first.' },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }
  if (stageNumber < participant.current_stage) {
    return NextResponse.json(
      { error: 'You have already completed this stage.' },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }

  const content = await getStageContent(stageNumber);
  if (!content) {
    return NextResponse.json({ error: 'Stage not found.' }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  const body: StageContentResponse = {
    stageNumber: content.stage_number,
    difficulty: content.difficulty,
    puzzleText: content.puzzle_text,
    hintText: content.hint_text,
    wordFragment: content.word_fragment,
  };

  return NextResponse.json(body, { headers: NO_CACHE_HEADERS });
}
