/**
 * lib/services/student.service.ts
 *
 * Service layer for student registration.
 * Handles input validation, ban list checks, duplicate detection,
 * participant insertion, and JWT session creation.
 *
 * Requirements: 2.1–2.10
 */

import { db } from '../db';
import { participants, banList, stageCompletions, studentSessions, deletionAuditLog } from '../db/schema';
import { eq, and, ne, or, sql } from 'drizzle-orm';
import { createStudentJwt } from './session.service';
import { registerRequestSchema, type RegisterResponse } from '../types';

// ─── registerStudent ───────────────────────────────────────────────────────────

/**
 * Register a new student for the treasure hunt.
 *
 * Validation order:
 *  1. Zod schema validation (name length/format, phone 10-digit)
 *  2. Ban list check (case-insensitive name OR exact phone)
 *  3. Cancelled participant check (permanent ineligibility)
 *  4. Duplicate name check (non-cancelled participants, case-insensitive)
 *  5. Duplicate phone check (non-cancelled participants)
 *  6. Insert participant row + create JWT session
 *
 * @param name   Student's display name (2–100 chars)
 * @param phone  10-digit phone number string
 * @returns `RegisterResponse` containing JWT token and participant details
 * @throws `{ status: 400, message }` for validation errors
 * @throws `{ status: 403, message }` for ban list or cancelled participant
 * @throws `{ status: 409, message }` for duplicate name or phone
 * @throws `{ status: 500, message }` for unexpected DB errors
 */
export async function registerStudent(
  name: string,
  phone: string,
): Promise<RegisterResponse> {
  // 1. Validate inputs
  const parsed = registerRequestSchema.safeParse({ name, phone });
  if (!parsed.success) {
    const msg =
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? 'Invalid input.';
    throw { status: 400, message: msg };
  }
  const { name: cleanName, phone: cleanPhone } = parsed.data;

  // 2. Check ban list (case-insensitive name OR exact phone)
  const bans = await db
    .select({ id: banList.id })
    .from(banList)
    .where(
      or(
        and(
          sql`${banList.name} IS NOT NULL`,
          sql`LOWER(${banList.name}) = LOWER(${cleanName})`,
        ),
        and(
          sql`${banList.phone} IS NOT NULL`,
          eq(banList.phone, cleanPhone),
        ),
      ),
    )
    .limit(1);

  if (bans.length > 0) {
    throw { status: 403, message: 'Registration is not allowed.' };
  }

  // 3. Check cancelled participants (permanent ineligibility)
  //    Matching by name (case-insensitive) OR phone against any cancelled row
  const cancelled = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        eq(participants.status, 'cancelled'),
        or(
          sql`LOWER(${participants.name}) = LOWER(${cleanName})`,
          eq(participants.phone, cleanPhone),
        ),
      ),
    )
    .limit(1);

  if (cancelled.length > 0) {
    throw {
      status: 403,
      message: 'Your registration was cancelled. You cannot re-register.',
    };
  }

  // 4. Check duplicate name (non-cancelled participants, case-insensitive)
  const dupName = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        ne(participants.status, 'cancelled'),
        sql`LOWER(${participants.name}) = LOWER(${cleanName})`,
      ),
    )
    .limit(1);

  if (dupName.length > 0) {
    throw { status: 409, message: 'This name is already registered.' };
  }

  // 5. Check duplicate phone (non-cancelled participants)
  const dupPhone = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        ne(participants.status, 'cancelled'),
        eq(participants.phone, cleanPhone),
      ),
    )
    .limit(1);

  if (dupPhone.length > 0) {
    throw { status: 409, message: 'This phone number is already registered.' };
  }

  // 6. Insert participant row + create JWT session
  //    Any unique-constraint violation at the DB level is treated as a conflict.
  try {
    const [participant] = await db
      .insert(participants)
      .values({
        name: cleanName,
        phone: cleanPhone,
        status: 'active',
        current_stage: 1,
      })
      .returning();

    const token = await createStudentJwt(participant.id);

    return {
      token,
      participantId: participant.id,
      name: participant.name,
      currentStage: participant.current_stage,
    };
  } catch (err: any) {
    // PostgreSQL unique-violation error code
    if (err?.code === '23505') {
      if (err?.constraint?.includes('name')) {
        throw { status: 409, message: 'This name is already registered.' };
      }
      throw { status: 409, message: 'This phone number is already registered.' };
    }
    throw { status: 500, message: 'Registration failed. Please try again.' };
  }
}

// ─── getParticipantById ────────────────────────────────────────────────────────

/**
 * Fetch a single participant row by UUID.
 *
 * @param participantId  UUID of the participant
 * @returns The participant row, or `null` if not found
 */
export async function getParticipantById(participantId: string) {
  const rows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId))
    .limit(1);
  return rows[0] ?? null;
}

// ─── cancelParticipant ────────────────────────────────────────────────────────

/**
 * Cancel a participant's registration and void all their progress.
 *
 * Steps (all executed sequentially):
 *  1. Set `participants.status = 'cancelled'`, `cancelled_at`, `cancel_reason`
 *  2. Set `student_sessions.is_active = false` for all their sessions
 *  3. Delete `stage_completions` rows (void progress)
 *
 * The participant row is retained for audit purposes (Req 7.4).
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 *
 * @param participantId  UUID of the participant to cancel
 * @param reason         Cancellation reason
 */
export async function cancelParticipant(
  participantId: string,
  reason: import('../types').CancelReason,
): Promise<void> {
  // Fetch current stage for audit log
  const rows = await db.select().from(participants).where(eq(participants.id, participantId)).limit(1);
  const p = rows[0];

  // Write audit log entry before cancelling
  if (p) {
    await db.insert(deletionAuditLog).values({
      participant_name: p.name,
      participant_phone: p.phone,
      stage_at_deletion: p.current_stage,
      action: reason,
      performed_by: 'system',
      extra_info: `Auto-cancelled: ${reason}`,
    }).catch(() => {}); // don't block cancellation if audit write fails
  }

  // 1. Mark participant as cancelled
  await db
    .update(participants)
    .set({ status: 'cancelled', cancelled_at: new Date(), cancel_reason: reason })
    .where(eq(participants.id, participantId));

  // 2. Deactivate all their sessions
  await db
    .update(studentSessions)
    .set({ is_active: false })
    .where(eq(studentSessions.participant_id, participantId));

  // 3. Delete stage completion records
  await db
    .delete(stageCompletions)
    .where(eq(stageCompletions.participant_id, participantId));
}
