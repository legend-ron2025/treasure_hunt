import { NextRequest, NextResponse } from 'next/server';
import { requireStudentAuth, isAuthError } from '@/lib/studentAuth';
import { dropoutRequestSchema } from '@/lib/types';
import { cancelParticipant } from '@/lib/services/student.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Beacon API sends text/plain; we need to handle both JSON and text
  let reason: 'dropout_tab_close' | 'dropout_navigation' = 'dropout_tab_close';
  try {
    const text = await request.text();
    const body = JSON.parse(text);
    const parsed = dropoutRequestSchema.safeParse(body);
    if (parsed.success) reason = parsed.data.reason;
  } catch {
    // ignore parse errors — use default reason
  }

  const auth = await requireStudentAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    await cancelParticipant(auth.participantId, reason);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/student/dropout]', err);
    return NextResponse.json({ error: 'Dropout failed.' }, { status: 500 });
  }
}
