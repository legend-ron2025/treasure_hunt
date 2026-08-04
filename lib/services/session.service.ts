/**
 * lib/services/session.service.ts
 *
 * Service layer for student session management.
 * Handles JWT creation, validation, heartbeat updates, and session deactivation.
 *
 * Requirements: 7.3, 7.4
 */

import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'crypto';
import { db } from '../db';
import { studentSessions } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const STUDENT_JWT_SECRET = new TextEncoder().encode(process.env.STUDENT_JWT_SECRET!);

// ─── hashToken ────────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 hex digest of a JWT string.
 * This is what gets stored in `student_sessions.token_hash`.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ─── createStudentJwt ─────────────────────────────────────────────────────────

/**
 * Sign a new student JWT (HS256) and persist the session row.
 *
 * JWT payload: `{ sub: participantId, iat, exp: +24h }`
 * The SHA-256 hash of the token is stored in `student_sessions.token_hash`
 * so it can be looked up during validation without storing the raw token.
 *
 * @param participantId  UUID of the participant
 * @returns The signed JWT string
 */
export async function createStudentJwt(participantId: string): Promise<string> {
  const token = await new SignJWT({ sub: participantId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(STUDENT_JWT_SECRET);

  const tokenHash = hashToken(token);
  await db.insert(studentSessions).values({
    participant_id: participantId,
    token_hash: tokenHash,
  });

  return token;
}

// ─── validateStudentToken ─────────────────────────────────────────────────────

/**
 * Validate a student JWT.
 *
 * Steps:
 *  1. Verify the JWT signature and expiry with `jose`.
 *  2. Hash the raw token and look it up in `student_sessions`.
 *  3. Reject if no active session row is found (e.g. participant was cancelled).
 *
 * @param token  Raw JWT string (from the Authorization header or cookie)
 * @returns `{ participantId, tokenHash }` on success
 * @throws `{ status: 401, message }` for invalid/expired token
 * @throws `{ status: 403, message }` for a valid token whose session is inactive
 */
export async function validateStudentToken(
  token: string,
): Promise<{ participantId: string; tokenHash: string }> {
  let participantId: string;
  try {
    const { payload } = await jwtVerify(token, STUDENT_JWT_SECRET);
    participantId = payload.sub as string;
  } catch {
    throw { status: 401, message: 'Invalid or expired token.' };
  }

  const tokenHash = hashToken(token);
  const sessionRows = await db
    .select()
    .from(studentSessions)
    .where(
      and(
        eq(studentSessions.token_hash, tokenHash),
        eq(studentSessions.is_active, true),
      ),
    )
    .limit(1);

  if (sessionRows.length === 0) {
    throw { status: 403, message: 'Your registration was cancelled. You cannot re-register.' };
  }

  return { participantId, tokenHash };
}

// ─── updateHeartbeat ──────────────────────────────────────────────────────────

/**
 * Touch `last_active_at` for the session identified by `tokenHash`.
 * Called periodically by the client to signal the session is still alive.
 *
 * @param tokenHash  SHA-256 hex digest of the student's JWT
 */
export async function updateHeartbeat(tokenHash: string): Promise<void> {
  await db
    .update(studentSessions)
    .set({ last_active_at: new Date() })
    .where(eq(studentSessions.token_hash, tokenHash));
}

// ─── deactivateSession ────────────────────────────────────────────────────────

/**
 * Mark all sessions for a participant as inactive.
 * Called by `cancelParticipant` when a student drops out or is removed by an admin.
 *
 * @param participantId  UUID of the participant whose sessions should be revoked
 */
export async function deactivateSession(participantId: string): Promise<void> {
  await db
    .update(studentSessions)
    .set({ is_active: false })
    .where(eq(studentSessions.participant_id, participantId));
}
