import { NextRequest, NextResponse } from 'next/server';
import { logoutAdmin } from '@/lib/services/auth.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'No token provided.' }, { status: 400 });
  }

  try {
    await logoutAdmin(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/admin/logout]', err);
    return NextResponse.json({ error: 'Logout failed.' }, { status: 500 });
  }
}
