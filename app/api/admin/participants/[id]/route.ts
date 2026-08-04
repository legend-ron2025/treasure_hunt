import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { participants, deletionAuditLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cancelParticipant } from '@/lib/services/student.service';
import { deleteParticipantRequestSchema } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const parsed = deleteParticipantRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Confirmation required.' }, { status: 400 });

  const rows = await db.select().from(participants).where(eq(participants.id, params.id)).limit(1);
  const p = rows[0];
  if (!p) return NextResponse.json({ error: 'Participant not found.' }, { status: 404 });

  await db.insert(deletionAuditLog).values({
    participant_name: p.name, participant_phone: p.phone,
    stage_at_deletion: p.current_stage, action: 'delete_student', performed_by: auth.username,
  });
  await db.delete(participants).where(eq(participants.id, params.id));

  return NextResponse.json({ deleted: true });
}
