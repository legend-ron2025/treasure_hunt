import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { banList, participants, stageCompletions, studentSessions, deletionAuditLog } from '@/lib/db/schema';
import { eq, or, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  // Fetch the ban entry before deleting so we can match participants
  const banRows = await db.select().from(banList).where(eq(banList.id, params.id)).limit(1);
  const ban = banRows[0];

  if (!ban) {
    return NextResponse.json({ deleted: true }); // already gone
  }

  // Build match condition for participants with same name or phone as this ban entry
  const conditions: ReturnType<typeof and>[] = [];
  if (ban.name) {
    conditions.push(sql`LOWER(${participants.name}) = LOWER(${ban.name})`);
  }
  if (ban.phone) {
    conditions.push(eq(participants.phone, ban.phone));
  }

  if (conditions.length > 0) {
    // Find cancelled participants matching this ban entry
    const matchedParticipants = await db
      .select({ id: participants.id, name: participants.name, phone: participants.phone })
      .from(participants)
      .where(
        and(
          eq(participants.status, 'cancelled'),
          conditions.length === 1 ? conditions[0]! : or(...conditions),
        ),
      );

    for (const p of matchedParticipants) {
      // Write unban audit log entry
      await db.insert(deletionAuditLog).values({
        participant_name: p.name,
        participant_phone: p.phone,
        stage_at_deletion: 1,
        action: 'admin_manual',
        performed_by: auth.username,
        extra_info: 'Unbanned: participant status restored to active, progress reset to stage 1',
      }).catch(() => {});

      // Restore participant: set status back to active, reset to stage 1
      await db
        .update(participants)
        .set({
          status: 'active',
          current_stage: 1,
          cancelled_at: null,
          cancel_reason: null,
        })
        .where(eq(participants.id, p.id));

      // Clear any old stage completions so they start fresh
      await db
        .delete(stageCompletions)
        .where(eq(stageCompletions.participant_id, p.id));

      // Reactivate their sessions (they'll need to re-register — their token is gone,
      // but at least they're no longer blocked from registering fresh)
      await db
        .update(studentSessions)
        .set({ is_active: false })
        .where(eq(studentSessions.participant_id, p.id));
    }
  }

  // Delete the ban entry
  await db.delete(banList).where(eq(banList.id, params.id));

  return NextResponse.json({ deleted: true });
}
