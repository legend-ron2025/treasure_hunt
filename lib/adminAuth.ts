import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession } from './services/auth.service';

/**
 * Extract and validate an admin JWT from the request.
 * Call this at the top of each admin API route handler.
 *
 * Returns { adminId, username } on success.
 * Returns a NextResponse 401/403 on failure (caller should return it immediately).
 *
 * Validates admin JWT from Authorization header (Bearer <token>),
 * checks admin_sessions.is_active, and returns admin info on success.
 *
 * Requirements: 12.1, 12.2
 */
export async function requireAdminAuth(
  request: NextRequest,
): Promise<{ adminId: string; username: string } | NextResponse> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const admin = await validateAdminSession(token);
    return admin;
  } catch (err: any) {
    const status = err?.status ?? 401;
    const message = err?.message ?? 'Authentication required.';
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * Type guard: check if requireAdminAuth returned an error response.
 * Use this to short-circuit route handlers when auth fails:
 *
 * @example
 * const auth = await requireAdminAuth(request);
 * if (isAuthError(auth)) return auth;
 * // auth is now { adminId, username }
 */
export function isAuthError(
  result: { adminId: string; username: string } | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
