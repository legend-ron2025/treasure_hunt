import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { participants, stageCompletions, studentSessions, deletionAuditLog } from '@/lib/db/schema';
import { eq, and, asc, desc, ne, sql } from 'drizzle-orm';
import { cancelParticipant } from '@/lib/services/student.service';
import { bulkDeleteParticipantsRequestSchema } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const sort = searchParams.get('sort') ?? 'stage_desc';

  // Always fetch fresh from DB with no caching
  const rows = await db.select().from(participants);

  const filtered = status ? rows.filter((p) => p.status === status) : rows;

  filtered.sort((a, b) => {
    if (sort === 'name_asc') return a.name.localeCompare(b.name);
    if (sort === 'stage_desc') return (b.current_stage - a.current_stage) || (a.registered_at.getTime() - b.registered_at.getTime());
    if (sort === 'registered_asc') return a.registered_at.getTime() - b.registered_at.getTime();
    return 0;
  });

  return NextResponse.json(
    filtered.map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      status: p.status,
      currentStage: p.current_stage,
      registeredAt: p.registered_at.toISOString(),
      cancelledAt: p.cancelled_at ? new Date(p.cancelled_at).toISOString() : null,
      cancelReason: p.cancel_reason,
    })),
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    },
  );
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;
  // Bulk delete
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const parsed = bulkDeleteParticipantsRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  for (const id of parsed.data.ids) {
    const rows = await db.select().from(participants).where(eq(participants.id, id)).limit(1);
    const p = rows[0];
    if (!p) continue;
    await db.insert(deletionAuditLog).values({
      participant_name: p.name, participant_phone: p.phone,
      stage_at_deletion: p.current_stage, action: 'delete_student', performed_by: auth.username,
    });
    await db.delete(participants).where(eq(participants.id, id));
  }
  return NextResponse.json({ deleted: parsed.data.ids.length });
}
