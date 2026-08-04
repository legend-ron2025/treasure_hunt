import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { participants, stageCompletions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getLeaderboard } from '@/lib/services/leaderboard.service';
import type { DashboardSnapshot, ParticipantRow, DashboardSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  const allParticipants = await db.select().from(participants);
  const serverTime = new Date();

  const rows: ParticipantRow[] = [];
  for (const p of allParticipants) {
    const completions = await db.select().from(stageCompletions).where(eq(stageCompletions.participant_id, p.id));
    const byStage: Record<number, string> = {};
    for (const c of completions) byStage[c.stage_number] = c.completed_at.toISOString();

    const enteredCurrentStageAt =
      p.current_stage === 1 ? p.registered_at.toISOString() :
      byStage[p.current_stage - 1] ?? p.registered_at.toISOString();

    rows.push({
      id: p.id, name: p.name, phone: p.phone,
      status: p.status as any, current_stage: p.current_stage,
      registered_at: p.registered_at.toISOString(),
      cancelled_at: p.cancelled_at?.toISOString() ?? null,
      cancel_reason: p.cancel_reason as any,
      stage1_at: byStage[1] ?? null, stage2_at: byStage[2] ?? null,
      stage3_at: byStage[3] ?? null, stage4_at: byStage[4] ?? null,
      stage5_at: byStage[5] ?? null,
      entered_current_stage_at: enteredCurrentStageAt,
    });
  }

  const summary: DashboardSummary = {
    total_registered: allParticipants.length,
    active: allParticipants.filter((p) => p.status === 'active').length,
    completed: allParticipants.filter((p) => p.status === 'completed').length,
    cancelled: allParticipants.filter((p) => p.status === 'cancelled').length,
    by_stage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
  for (const p of allParticipants.filter((p) => p.status === 'active')) {
    const s = Math.min(p.current_stage, 5) as 1 | 2 | 3 | 4 | 5;
    summary.by_stage[s]++;
  }

  const leaderboard = await getLeaderboard();
  const snapshot: DashboardSnapshot = { summary, participants: rows, leaderboard, server_time: serverTime.toISOString() };
  return NextResponse.json(snapshot);
}
