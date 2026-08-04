import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { participants, stageCompletions, deletionAuditLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  const rows = await db.select().from(participants).where(eq(participants.id, params.id)).limit(1);
  const p = rows[0];
  if (!p) return NextResponse.json({ error: 'Participant not found.' }, { status: 404 });

  await db.insert(deletionAuditLog).values({
    participant_name: p.name, participant_phone: p.phone,
    stage_at_deletion: p.current_stage, action: 'reset_progress', performed_by: auth.username,
  });
  await db.delete(stageCompletions).where(eq(stageCompletions.participant_id, params.id));
  await db.update(participants).set({ current_stage: 1 }).where(eq(participants.id, params.id));

  return NextResponse.json({ reset: true });
}
