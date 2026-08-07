/**
 * GET /api/student/event-status
 *
 * Returns event status, winner info, and participant progress summary
 * for the event-ended page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEventConfig, getEventStatus } from '@/lib/services/event.service';
import { db } from '@/lib/db';
import { participants, stageCompletions } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
};

export async function GET(_request: NextRequest) {
  const config = await getEventConfig();
  const status = getEventStatus(new Date(), config);

  // Event duration in seconds (start → end)
  const durationSeconds = config.start_time && config.end_time
    ? Math.round((new Date(config.end_time).getTime() - new Date(config.start_time).getTime()) / 1000)
    : null;

  // Winner = first completed participant (lowest total_seconds)
  const completedRows = await db
    .select({
      id: participants.id,
      name: participants.name,
      registered_at: participants.registered_at,
    })
    .from(participants)
    .where(eq(participants.status, 'completed'));

  let winner: { name: string; totalSeconds: number } | null = null;
  let winnerTotalSeconds = Infinity;

  for (const p of completedRows) {
    const s5 = await db
      .select({ completed_at: stageCompletions.completed_at })
      .from(stageCompletions)
      .where(eq(stageCompletions.participant_id, p.id))
      .orderBy(desc(stageCompletions.completed_at))
      .limit(1);

    if (s5[0]) {
      const totalSec = Math.round(
        (s5[0].completed_at.getTime() - p.registered_at.getTime()) / 1000,
      );
      if (totalSec < winnerTotalSeconds) {
        winnerTotalSeconds = totalSec;
        winner = { name: p.name, totalSeconds: totalSec };
      }
    }
  }

  // Participant progress — how many stages each active/completed student reached
  const allRows = await db
    .select({
      id: participants.id,
      name: participants.name,
      status: participants.status,
      current_stage: participants.current_stage,
    })
    .from(participants)
    .where(
      sql`${participants.status} IN ('active', 'completed')`,
    );

  const progress = allRows.map((p) => ({
    name: p.name,
    stagesCompleted: p.status === 'completed' ? 5 : Math.max(0, p.current_stage - 1),
    completed: p.status === 'completed',
  }));

  // Sort: completed first, then by stages desc
  progress.sort((a, b) => {
    if (a.completed && !b.completed) return -1;
    if (!a.completed && b.completed) return 1;
    return b.stagesCompleted - a.stagesCompleted;
  });

  return NextResponse.json(
    { status, winner, durationSeconds, progress },
    { headers: NO_CACHE },
  );
}
