/**
 * lib/services/export.service.ts
 * Requirements: 15.5, 18.10
 */
import { db } from '../db';
import { participants, stageCompletions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getLeaderboard } from './leaderboard.service';

function esc(v: string | null | undefined): string {
  if (!v) return '';
  return `"${String(v).replace(/"/g, '""')}"`;
}

export async function generateParticipantsCsv(): Promise<string> {
  const all = await db.select().from(participants);
  const lines = ['name,phone,status,current_stage,stage1_at,stage2_at,stage3_at,stage4_at,stage5_at,cancelled_at'];
  for (const p of all) {
    const c = await db.select().from(stageCompletions).where(eq(stageCompletions.participant_id, p.id));
    const by: Record<number, string> = {};
    for (const x of c) by[x.stage_number] = x.completed_at.toISOString();
    lines.push([
      esc(p.name), p.phone, p.status, p.current_stage,
      by[1] ?? '', by[2] ?? '', by[3] ?? '', by[4] ?? '', by[5] ?? '',
      p.cancelled_at?.toISOString() ?? '',
    ].join(','));
  }
  return lines.join('\n');
}

function fmtDuration(seconds: number | null): string {
  if (seconds === null) return '';
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export async function generateLeaderboardCsv(): Promise<string> {
  const board = await getLeaderboard();
  const lines = ['rank,name,phone,registered_at,stage1_at,stage2_at,stage3_at,stage4_at,stage5_at,stage1_duration,stage2_duration,stage3_duration,stage4_duration,stage5_duration,total_elapsed'];
  for (const e of board) {
    lines.push([
      e.rank, esc(e.name), e.phone, e.registered_at,
      e.stage1_at ?? '', e.stage2_at ?? '', e.stage3_at ?? '', e.stage4_at ?? '', e.stage5_at ?? '',
      fmtDuration(e.stage1_seconds), fmtDuration(e.stage2_seconds), fmtDuration(e.stage3_seconds),
      fmtDuration(e.stage4_seconds), fmtDuration(e.stage5_seconds),
      fmtDuration(e.total_seconds),
    ].join(','));
  }
  return lines.join('\n');
}
