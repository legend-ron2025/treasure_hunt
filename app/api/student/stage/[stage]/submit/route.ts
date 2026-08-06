/**
 * POST /api/student/stage/:stage/submit
 *
 * Verifies the submitted access code and advances the participant to the
 * next stage on success.
 *
 * Requirements: 5.8, 5.9, 5.10, 5.11, 5.12
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireStudentAuth, isAuthError } from '@/lib/studentAuth';
import { getParticipantById } from '@/lib/services/student.service';
import { verifyAccessCode, advanceParticipantStage } from '@/lib/services/stage.service';
import { submitAccessCodeRequestSchema } from '@/lib/types';
import type { SubmitAccessCodeResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function POST(
  request: NextRequest,
  { params }: { params: { stage: string } },
) {
  const auth = await requireStudentAuth(request);
  if (isAuthError(auth)) return auth;

  const stageNumber = parseInt(params.stage, 10);
  if (isNaN(stageNumber) || stageNumber < 1 || stageNumber > 5) {
    return NextResponse.json({ error: 'Invalid stage number.' }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const parsed = submitAccessCodeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Access code must be 6 characters.' },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  // Participant check
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

  // Stage authorization
  if (stageNumber > participant.current_stage) {
    return NextResponse.json(
      { error: 'Please complete your current stage first.' },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }
  if (stageNumber < participant.current_stage) {
    // Already completed this stage — transition student forward to their active stage
    const nextAction: SubmitAccessCodeResponse['nextAction'] =
      participant.current_stage <= 5
        ? { type: 'scan_qr', nextStage: participant.current_stage }
        : { type: 'congratulations' };
    const res: SubmitAccessCodeResponse = { success: true, nextAction };
    return NextResponse.json(res, { headers: NO_CACHE_HEADERS });
  }

  // Verify access code (case-insensitive)
  const correct = await verifyAccessCode(stageNumber, parsed.data.accessCode);
  if (!correct) {
    const res: SubmitAccessCodeResponse = {
      success: false,
      error: 'Incorrect access code. Please try again.',
    };
    return NextResponse.json(res, { status: 422, headers: NO_CACHE_HEADERS });
  }

  // Advance participant to next stage
  await advanceParticipantStage(auth.participantId, stageNumber);

  // Determine next action for client
  const nextAction: SubmitAccessCodeResponse['nextAction'] =
    stageNumber < 5
      ? { type: 'scan_qr', nextStage: stageNumber + 1 }
      : { type: 'congratulations' };

  const res: SubmitAccessCodeResponse = { success: true, nextAction };
  return NextResponse.json(res, { headers: NO_CACHE_HEADERS });
}
