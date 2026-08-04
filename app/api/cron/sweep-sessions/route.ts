/**
 * app/api/cron/sweep-sessions/route.ts
 *
 * Vercel Cron endpoint — runs every 5 minutes (see vercel.json).
 * Finds all active student sessions that have been inactive for > 30 minutes
 * and cancels the corresponding participant with reason 'dropout_inactivity'.
 *
 * Security: Vercel Cron attaches `Authorization: Bearer <CRON_SECRET>` to
 * every invocation. Requests that omit or mismatch the header are rejected
 * with 401 before any DB work is performed.
 *
 * Requirements: 7.3, 7.4, 7.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { studentSessions } from '@/lib/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { cancelParticipant } from '@/lib/services/student.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ── Verify CRON_SECRET ────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // ── Find all active sessions inactive for > 30 minutes ─────────────────
    const staleSessions = await db
      .select({
        participant_id: studentSessions.participant_id,
      })
      .from(studentSessions)
      .where(
        and(
          eq(studentSessions.is_active, true),
          lt(studentSessions.last_active_at, thirtyMinutesAgo),
        ),
      );

    // ── Cancel each stale participant ───────────────────────────────────────
    let cancelled = 0;
    for (const session of staleSessions) {
      try {
        await cancelParticipant(session.participant_id, 'dropout_inactivity');
        cancelled++;
      } catch (err) {
        console.error(
          '[sweep-sessions] Failed to cancel participant:',
          session.participant_id,
          err,
        );
      }
    }

    console.log(`[sweep-sessions] Cancelled ${cancelled} of ${staleSessions.length} inactive sessions.`);
    return NextResponse.json({ cancelled, checked: staleSessions.length });
  } catch (err) {
    console.error('[GET /api/cron/sweep-sessions]', err);
    return NextResponse.json({ error: 'Sweep failed.' }, { status: 500 });
  }
}
