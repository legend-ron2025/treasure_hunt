import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { participants, eventConfig, resetLog } from '@/lib/db/schema';
import { resetEventRequestSchema } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const parsed = resetEventRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Confirmation required: send { confirm: "RESET EVENT" }' }, { status: 400 });

  // Count participants before delete
  const allParticipants = await db.select({ id: participants.id }).from(participants);
  const count = allParticipants.length;

  // Delete all participants (cascade deletes sessions, completions)
  await db.delete(participants);

  // Clear event schedule
  await db.update(eventConfig).set({ start_time: null, end_time: null, updated_at: new Date() });

  // Write reset log
  await db.insert(resetLog).values({ performed_by: auth.username, participants_deleted: count });

  return NextResponse.json({ participantsDeleted: count, performedAt: new Date().toISOString() });
}
