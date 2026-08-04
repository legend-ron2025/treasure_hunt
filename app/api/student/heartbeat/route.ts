import { NextRequest, NextResponse } from 'next/server';
import { requireStudentAuth, isAuthError } from '@/lib/studentAuth';
import { updateHeartbeat } from '@/lib/services/session.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    await updateHeartbeat(auth.tokenHash);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/student/heartbeat]', err);
    return NextResponse.json({ error: 'Heartbeat failed.' }, { status: 500 });
  }
}
