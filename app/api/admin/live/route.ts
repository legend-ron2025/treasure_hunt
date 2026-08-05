import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { participants, stageCompletions } from '@/lib/db/schema';
import { getLeaderboard } from '@/lib/services/leaderboard.service';
import type { DashboardSnapshot, ParticipantRow, DashboardSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  // Fetch all participants + all stage completions in 2 queries (not N+1)
  const [allParticipants, allCompletions] = await Promise.all([
    db.select().from(participants),
    db.select().from(stageCompletions),
  ]);

  const serverTime = new Date();

  // Build completion map: participantId -> { stageNumber -> completedAt ISO }
  const completionMap = new Map<string, Record<number, string>>();
  for (const c of allCompletions) {
    if (!completionMap.has(c.participant_id)) completionMap.set(c.participant_id, {});
    completionMap.get(c.participant_id)![c.stage_number] = new Date(c.completed_at).toISOString();
  }

  const rows: ParticipantRow[] = allParticipants.map((p) => {
    const byStage = completionMap.get(p.id) ?? {};
    const enteredCurrentStageAt =
      p.current_stage === 1
        ? new Date(p.registered_at).toISOString()
        : byStage[p.current_stage - 1] ?? new Date(p.registered_at).toISOString();

    return {
      id: p.id,
      name: p.name,
      phone: p.phone,
      status: p.status as any,
      current_stage: p.current_stage,
      registered_at: new Date(p.registered_at).toISOString(),
      cancelled_at: p.cancelled_at ? new Date(p.cancelled_at).toISOString() : null,
      cancel_reason: p.cancel_reason as any,
      stage1_at: byStage[1] ?? null,
      stage2_at: byStage[2] ?? null,
      stage3_at: byStage[3] ?? null,
      stage4_at: byStage[4] ?? null,
      stage5_at: byStage[5] ?? null,
      entered_current_stage_at: enteredCurrentStageAt,
    };
  });

  // Sort: stage desc, then registered_at asc
  rows.sort((a, b) => {
    if (b.current_stage !== a.current_stage) return b.current_stage - a.current_stage;
    return new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime();
  });

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

  const snapshot: DashboardSnapshot = {
    summary,
    participants: rows,
    leaderboard,
    server_time: serverTime.toISOString(),
  };

  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  });
}
