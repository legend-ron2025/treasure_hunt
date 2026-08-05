/**
 * POST /api/student/dropout
 *
 * Called via navigator.sendBeacon() when the student leaves the page.
 * Beacon API cannot set custom headers reliably in all browsers, so the
 * JWT token is passed in the request body: { token: '...', reason: '...' }
 *
 * Requirements: 7.1, 7.2
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateStudentToken } from '@/lib/services/session.service';
import { cancelParticipant } from '@/lib/services/student.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let reason: 'dropout_tab_close' | 'dropout_navigation' = 'dropout_tab_close';
  let participantId: string | null = null;

  try {
    const text = await request.text();
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(text); } catch { /* not valid JSON */ }

    // Parse reason
    const r = body.reason;
    if (r === 'dropout_tab_close' || r === 'dropout_navigation') reason = r;

    // Get token — from body first (Beacon API workaround), then Authorization header
    const bodyToken = typeof body.token === 'string' ? body.token.trim() : null;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = bodyToken || headerToken;

    if (token) {
      try {
        const result = await validateStudentToken(token);
        participantId = result.participantId;
      } catch {
        // Token invalid — nothing to cancel
      }
    }
  } catch {
    // Ignore all parse/read errors
  }

  if (!participantId) {
    // Return 200 anyway so Beacon doesn't retry
    return NextResponse.json({ ok: false, reason: 'no valid token' });
  }

  try {
    await cancelParticipant(participantId, reason);
  } catch (err) {
    console.error('[POST /api/student/dropout] cancel failed:', err);
  }

  return NextResponse.json({ ok: true });
}
