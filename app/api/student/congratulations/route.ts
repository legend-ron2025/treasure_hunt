import { NextRequest, NextResponse } from 'next/server';
import { requireStudentAuth, isAuthError } from '@/lib/studentAuth';
import { getCongratsData } from '@/lib/services/leaderboard.service';
import { db } from '@/lib/db';
import { participants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (isAuthError(auth)) return auth;

  // Mark participant as completed (retry 3×)
  for (let i = 0; i < 3; i++) {
    try {
      await db.update(participants)
        .set({ status: 'completed', current_stage: 6 })
        .where(eq(participants.id, auth.participantId));
      break;
    } catch { /* retry */ }
  }

  const data = await getCongratsData(auth.participantId);
  return NextResponse.json(data);
}
