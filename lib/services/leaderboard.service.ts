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
  // Fetch participant directly — don't rely on leaderboard query which may miss
  // this participant due to Neon read-after-write lag after status='completed' update.
  const pRows = await db.select().from(participants).where(eq(participants.id, participantId)).limit(1);
  const p = pRows[0];
  if (!p) throw { status: 404, message: 'Participant not found.' };

  // Compute this participant's own time directly from their stage completions
  const myCompletions = await db
    .select()
    .from(stageCompletions)
    .where(eq(stageCompletions.participant_id, participantId));

  const myByStage: Record<number, number> = {};
  for (const c of myCompletions) {
    myByStage[c.stage_number] = c.completed_at.getTime();
  }

  const reg = p.registered_at.getTime();
  const s5 = myByStage[5];
  // If stage 5 completion exists, use it. Otherwise fall back to now (shouldn't happen).
  const totalElapsedSeconds = s5 ? Math.round((s5 - reg) / 1000) : 0;

  // Build leaderboard — retry up to 3× with delay to handle read-after-write lag
  let board: LeaderboardEntry[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    board = await getLeaderboard();
    // Check if this participant appears in the board
    const found = board.find((e) => e.name === p.name && e.phone === p.phone);
    if (found) break;
    // Not found yet — wait and retry
    if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }

  // Determine rank from leaderboard; if still not found, compute rank manually:
  // count how many others have a smaller total_seconds than this participant
  const myEntry = board.find((e) => e.name === p.name && e.phone === p.phone);
  let rank: number;
  if (myEntry) {
    rank = myEntry.rank;
  } else {
    // Participant not yet in leaderboard due to lag — count competitors with faster times
    const fasterCount = board.filter((e) => e.total_seconds < totalElapsedSeconds).length;
    rank = fasterCount + 1;
  }

  const top10 = board.slice(0, 10);

  // If this participant isn't in top10 yet (lag), inject them so they can see their own entry
  const alreadyIn = top10.some((e) => e.name === p.name);
  if (!alreadyIn && top10.length < 10) {
    top10.push({
      rank,
      name: p.name,
      phone: p.phone,
      registered_at: p.registered_at.toISOString(),
      stage1_at: myByStage[1] ? new Date(myByStage[1]).toISOString() : null,
      stage2_at: myByStage[2] ? new Date(myByStage[2]).toISOString() : null,
      stage3_at: myByStage[3] ? new Date(myByStage[3]).toISOString() : null,
      stage4_at: myByStage[4] ? new Date(myByStage[4]).toISOString() : null,
      stage5_at: s5 ? new Date(s5).toISOString() : null,
      stage1_seconds: myByStage[1] ? Math.round((myByStage[1] - reg) / 1000) : null,
      stage2_seconds: myByStage[1] && myByStage[2] ? Math.round((myByStage[2] - myByStage[1]) / 1000) : null,
      stage3_seconds: myByStage[2] && myByStage[3] ? Math.round((myByStage[3] - myByStage[2]) / 1000) : null,
      stage4_seconds: myByStage[3] && myByStage[4] ? Math.round((myByStage[4] - myByStage[3]) / 1000) : null,
      stage5_seconds: myByStage[4] && s5 ? Math.round((s5 - myByStage[4]) / 1000) : null,
      total_seconds: totalElapsedSeconds,
    });
    // Re-sort top10 after injection
    top10.sort((a, b) => a.total_seconds - b.total_seconds || a.name.localeCompare(b.name));
    top10.forEach((e, i) => { e.rank = i + 1; });
    // Re-read rank in case it shifted
    const meAgain = top10.find((e) => e.name === p.name);
    if (meAgain) rank = meAgain.rank;
  }

  return { name: p.name, totalElapsedSeconds, rank, leaderboard: top10 };
}
