/**
 * lib/studentAuth.ts
 *
 * Middleware helper for student API routes.
 * Extracts and validates the Bearer JWT from the Authorization header,
 * then verifies the token signature and checks that the session is active.
 *
 * Requirements: 7.6, 7.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateStudentToken } from './services/session.service';

export interface StudentAuthResult {
  participantId: string;
  tokenHash: string;
}

/**
 * Extract and validate a student JWT from the request.
 * Call at the top of each student API route handler.
 *
 * Returns StudentAuthResult on success.
 * Returns a NextResponse with appropriate error on failure.
 */
export async function requireStudentAuth(
  request: NextRequest,
): Promise<StudentAuthResult | NextResponse> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { participantId, tokenHash } = await validateStudentToken(token);
    return { participantId, tokenHash };
  } catch (err: any) {
    const status = err?.status ?? 401;
    const message = err?.message ?? 'Authentication required.';
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * Type guard: check if requireStudentAuth returned an error response.
 */
export function isAuthError(
  result: StudentAuthResult | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
