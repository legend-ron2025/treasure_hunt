import { NextRequest, NextResponse } from 'next/server';
import { requireStudentAuth, isAuthError } from '@/lib/studentAuth';
import { getParticipantById } from '@/lib/services/student.service';
import type { StudentMeResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (isAuthError(auth)) return auth;

  const participant = await getParticipantById(auth.participantId);
  if (!participant) {
    return NextResponse.json({ error: 'Participant not found.' }, { status: 404 });
  }

  const body: StudentMeResponse = {
    participantId: participant.id,
    name: participant.name,
    currentStage: participant.current_stage,
    status: participant.status as 'active' | 'completed' | 'cancelled',
  };

  return NextResponse.json(body);
}
