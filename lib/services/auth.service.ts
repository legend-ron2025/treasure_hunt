/**
 * lib/services/auth.service.ts
 *
 * Admin authentication service.
 *
 * Covers:
 *   - Admin login with bcrypt password verification (Req 12.1)
 *   - JWT session creation (HS256, jose) + token_hash storage (Req 12.2)
 *   - Session validation with inactivity expiry check (Req 12.3)
 *   - Brute-force lockout: 5 failures in 10 min → 15-min lockout (Req 12.7)
 */

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'crypto';
import { db } from '../db';
import { admins, adminSessions, adminLoginAttempts } from '../db/schema';
import { eq, and, gt, lt, desc } from 'drizzle-orm';


// ─── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_JWT_SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!);

/** Session inactivity TTL in hours (Req 12.3) */
const SESSION_TTL_HOURS = 8;

/** Brute-force sliding window in minutes (Req 12.7) */
const BRUTE_WINDOW_MINUTES = 10;

/** Maximum consecutive failures before lockout (Req 12.7) */
const BRUTE_MAX_FAILURES = 5;

/** Lockout duration in minutes (Req 12.7) */
const BRUTE_LOCKOUT_MINUTES = 15;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** SHA-256 hex hash of a token — stored in DB, never the raw JWT. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ─── Brute-force guard ─────────────────────────────────────────────────────────

/**
 * Check whether an IP is currently locked out due to repeated failures.
 *
 * Algorithm:
 *  1. Fetch the most recent (BRUTE_MAX_FAILURES + 1) attempts for the IP
 *     within the sliding BRUTE_WINDOW_MINUTES window.
 *  2. Walk from the most recent attempt backwards; count consecutive failures.
 *  3. If ≥ BRUTE_MAX_FAILURES consecutive failures exist, compute lockout
 *     expiry as (most-recent-failure + BRUTE_LOCKOUT_MINUTES).
 *  4. If that expiry is still in the future, return it; otherwise null.
 *
 * @returns Lockout expiry Date if the IP is locked out, null otherwise.
 */
export async function checkBruteForce(ip: string): Promise<Date | null> {
  const windowStart = new Date(Date.now() - BRUTE_WINDOW_MINUTES * 60_000);

  const attempts = await db
    .select()
    .from(adminLoginAttempts)
    .where(
      and(
        eq(adminLoginAttempts.ip_address, ip),
        gt(adminLoginAttempts.attempted_at, windowStart),
      ),
    )
    .orderBy(desc(adminLoginAttempts.attempted_at))
    .limit(BRUTE_MAX_FAILURES + 1);

  // Count consecutive failures from the most-recent attempt backwards.
  let consecutiveFailures = 0;
  for (const attempt of attempts) {
    if (attempt.succeeded) break;
    consecutiveFailures++;
  }

  if (consecutiveFailures >= BRUTE_MAX_FAILURES) {
    const mostRecent = attempts[0].attempted_at;
    const lockoutExpiry = new Date(
      mostRecent.getTime() + BRUTE_LOCKOUT_MINUTES * 60_000,
    );
    if (lockoutExpiry > new Date()) return lockoutExpiry;
  }

  return null;
}

// ─── Login ─────────────────────────────────────────────────────────────────────

/**
 * Attempt to log in as an admin.
 *
 * Steps:
 *  1. Reject immediately (429) if the IP is locked out.
 *  2. Look up the admin row by username.
 *  3. Compare the supplied password against the stored bcrypt hash.
 *  4. Record the attempt (succeeded or not) in admin_login_attempts.
 *  5. On failure, throw a 401 error object.
 *  6. On success, sign a HS256 JWT (8-hour expiry), persist a token_hash row
 *     in admin_sessions, and return the raw JWT string.
 *
 * @param username  Plain-text username supplied by the admin.
 * @param password  Plain-text password supplied by the admin.
 * @param ip        Client IP address, used for brute-force tracking.
 * @returns         Signed JWT string on success.
 * @throws          `{ status: 429, message }` when locked out.
 * @throws          `{ status: 401, message }` on bad credentials.
 */
export async function loginAdmin(
  username: string,
  password: string,
  ip: string,
): Promise<string> {
  // 1. Brute-force check
  const lockoutExpiry = await checkBruteForce(ip);
  if (lockoutExpiry) {
    throw { status: 429, message: 'Too many failed attempts. Please try again later.' };
  }

  // 2. Fetch admin row
  const adminRows = await db
    .select()
    .from(admins)
    .where(eq(admins.username, username))
    .limit(1);

  const admin = adminRows[0];

  // 3. Verify password (always run compare to prevent timing attacks when admin not found)
  const DUMMY_HASH = '$2b$12$invalidhashpaddingthatnevermatchesXXXXXXXXXXXXXXXXXX';
  const valid = admin
    ? await bcrypt.compare(password, admin.password_hash)
    : (await bcrypt.compare(password, DUMMY_HASH), false);

  // 4. Record attempt
  await db.insert(adminLoginAttempts).values({
    ip_address: ip,
    succeeded: valid,
  });

  // 5. Reject on bad credentials
  if (!valid) {
    throw { status: 401, message: 'Invalid username or password.' };
  }

  // 6. Create session JWT
  const token = await new SignJWT({ sub: admin!.id, role: 'admin' as const })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(ADMIN_JWT_SECRET);

  const tokenHash = hashToken(token);

  await db.insert(adminSessions).values({
    username: admin!.username,
    token_hash: tokenHash,
  });

  return token;
}

// ─── Session validation ────────────────────────────────────────────────────────

/**
 * Validate an admin session token.
 *
 * Steps:
 *  1. Verify the JWT signature and expiry using jose.
 *  2. Hash the token and look for a matching active session row whose
 *     last_active_at is within the 8-hour inactivity window.
 *  3. If found, refresh last_active_at to extend the inactivity window.
 *  4. Return { adminId, username } so the caller can attach it to the request.
 *
 * @param token  Raw JWT string from the Authorization header or cookie.
 * @returns      `{ adminId: string; username: string }` on success.
 * @throws       `{ status: 401, message }` on any failure.
 */
export async function validateAdminSession(
  token: string,
): Promise<{ adminId: string; username: string }> {
  // 1. Verify JWT signature + expiry
  let payload: { sub?: string };
  try {
    const result = await jwtVerify(token, ADMIN_JWT_SECRET);
    payload = result.payload as { sub?: string };
  } catch {
    throw { status: 401, message: 'Invalid or expired session.' };
  }

  // 2. Check active session with inactivity guard (Req 12.3)
  const tokenHash = hashToken(token);
  const eightHoursAgo = new Date(Date.now() - SESSION_TTL_HOURS * 60 * 60 * 1000);

  const sessionRows = await db
    .select()
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.token_hash, tokenHash),
        eq(adminSessions.is_active, true),
        gt(adminSessions.last_active_at, eightHoursAgo),
      ),
    )
    .limit(1);

  if (sessionRows.length === 0) {
    throw { status: 401, message: 'Session expired or invalid.' };
  }

  // 3. Refresh inactivity timer
  await db
    .update(adminSessions)
    .set({ last_active_at: new Date() })
    .where(eq(adminSessions.token_hash, tokenHash));

  return { adminId: payload.sub!, username: sessionRows[0].username };
}

// ─── Logout / Session expiry ───────────────────────────────────────────────────

/**
 * Invalidate an admin session (logout or explicit expiry).
 * Sets `is_active = false` for the matching token_hash row (Req 12.3).
 *
 * @param token  Raw JWT string to invalidate.
 */
export async function logoutAdmin(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db
    .update(adminSessions)
    .set({ is_active: false })
    .where(eq(adminSessions.token_hash, tokenHash));
}

/**
 * Expire all sessions whose `last_active_at` is older than SESSION_TTL_HOURS.
 * Intended to be called from a periodic cleanup job or on each admin request.
 *
 * Uses a raw SQL comparison to avoid importing `sql` at the top when not
 * needed elsewhere in this module.
 */
export async function expireInactiveSessions(): Promise<void> {
  const cutoff = new Date(Date.now() - SESSION_TTL_HOURS * 60 * 60 * 1000);
  await db
    .update(adminSessions)
    .set({ is_active: false })
    .where(
      and(
        eq(adminSessions.is_active, true),
        lt(adminSessions.last_active_at, cutoff),
      ),
    );
}
