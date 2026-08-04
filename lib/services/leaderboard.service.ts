/**
 * lib/services/leaderboard.service.ts
 * Requirements: 13.1, 13.3–13.6, 18.3–18.5, 18.9
 */
import { db } from '../db';
import { participants, stageCompletions } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { LeaderboardEntry, CongratsResponse } from '../types';

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  // Fetch all completed participants with their stage completion timestamps
  const rows = await db
    .select({
      id: participants.id,
      name: participants.name,
      phone: participants.phone,
      registered_at: participants.registered_at,
    })
    .from(participants)
    .where(eq(participants.status, 'completed'));

  const entries: LeaderboardEntry[] = [];
  for (const p of rows) {
    const completions = await db
      .select()
      .from(stageCompletions)
      .where(eq(stageCompletions.participant_id, p.id));

    const byStage: Record<number, string> = {};
    for (const c of completions) {
      byStage[c.stage_number] = c.completed_at.toISOString();
    }

    const reg = p.registered_at.getTime();
    const s1 = byStage[1] ? new Date(byStage[1]).getTime() : null;
    const s2 = byStage[2] ? new Date(byStage[2]).getTime() : null;
    const s3 = byStage[3] ? new Date(byStage[3]).getTime() : null;
    const s4 = byStage[4] ? new Date(byStage[4]).getTime() : null;
    const s5 = byStage[5] ? new Date(byStage[5]).getTime() : null;

    if (!s5) continue; // skip incomplete

    const total_seconds = Math.round((s5 - reg) / 1000);

    entries.push({
      rank: 0,
      name: p.name,
      phone: p.phone,
      registered_at: p.registered_at.toISOString(),
      stage1_at: byStage[1] ?? null,
      stage2_at: byStage[2] ?? null,
      stage3_at: byStage[3] ?? null,
      stage4_at: byStage[4] ?? null,
      stage5_at: byStage[5] ?? null,
      stage1_seconds: s1 ? Math.round((s1 - reg) / 1000) : null,
      stage2_seconds: s1 && s2 ? Math.round((s2 - s1) / 1000) : null,
      stage3_seconds: s2 && s3 ? Math.round((s3 - s2) / 1000) : null,
      stage4_seconds: s3 && s4 ? Math.round((s4 - s3) / 1000) : null,
      stage5_seconds: s4 && s5 ? Math.round((s5 - s4) / 1000) : null,
      total_seconds,
    });
  }

  // Sort: total_seconds ASC, then name ASC for ties
  entries.sort((a, b) => a.total_seconds - b.total_seconds || a.name.localeCompare(b.name));
  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries;
}

export async function getCongratsData(participantId: string): Promise<CongratsResponse> {
  const board = await getLeaderboard();
  const entry = board.find((e) => {
    // match by participantId — need to join back
    return true; // we'll find by name below after fetching the participant
  });

  const pRows = await db.select().from(participants).where(eq(participants.id, participantId)).limit(1);
  const p = pRows[0];
  if (!p) throw { status: 404, message: 'Participant not found.' };

  const myEntry = board.find((e) => e.name === p.name && e.phone === p.phone);
  const rank = myEntry?.rank ?? board.length + 1;
  const totalElapsedSeconds = myEntry?.total_seconds ?? 0;
  const top10 = board.slice(0, 10);

  return { name: p.name, totalElapsedSeconds, rank, leaderboard: top10 };
}
