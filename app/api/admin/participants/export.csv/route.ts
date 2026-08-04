import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { participants, stageCompletions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  const allParticipants = await db.select().from(participants);
  const lines: string[] = ['name,phone,status,current_stage,stage1_at,stage2_at,stage3_at,stage4_at,stage5_at,cancelled_at'];

  for (const p of allParticipants) {
    const completions = await db.select().from(stageCompletions).where(eq(stageCompletions.participant_id, p.id));
    const byStage: Record<number, string> = {};
    for (const c of completions) byStage[c.stage_number] = c.completed_at.toISOString();
    lines.push([
      `"${p.name.replace(/"/g, '""')}"`, p.phone, p.status, p.current_stage,
      byStage[1] ?? '', byStage[2] ?? '', byStage[3] ?? '', byStage[4] ?? '', byStage[5] ?? '',
      p.cancelled_at?.toISOString() ?? '',
    ].join(','));
  }

  return new NextResponse(lines.join('\n'), {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="participants.csv"' },
  });
}
