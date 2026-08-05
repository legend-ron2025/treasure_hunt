import { NextRequest, NextResponse } from 'next/server';
import { requireStudentAuth, isAuthError } from '@/lib/studentAuth';
import { db } from '@/lib/db';
import { participants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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

  // If current_stage has advanced to 6, ensure status is marked completed
  let status = participant.status as 'active' | 'completed' | 'cancelled';
  if (participant.current_stage >= 6 && status === 'active') {
    // Lazily mark completed (the advance may have missed the status update)
    await db
      .update(participants)
      .set({ status: 'completed' })
      .where(eq(participants.id, participant.id));
    status = 'completed';
  }

  const body: StudentMeResponse = {
    participantId: participant.id,
    name: participant.name,
    currentStage: participant.current_stage,
    status,
  };

  return NextResponse.json(body);
}
