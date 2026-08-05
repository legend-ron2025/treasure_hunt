/**
 * POST /api/admin/participants/:id/reregister
 *
 * Admin-only: re-activates a cancelled participant so they can re-test the event.
 * Requires the admin to confirm the student's exact name AND phone number to prevent
 * accidental re-registration of the wrong person.
 *
 * Steps:
 *  1. Verify admin auth
 *  2. Find the participant by ID — must have status 'cancelled'
 *  3. Verify the submitted name (case-insensitive) and phone match exactly
 *  4. Reset status to 'active', current_stage to 1, clear cancelled_at / cancel_reason
 *  5. Delete any leftover stage_completions for this participant
 *  6. Create a fresh student session (new JWT)
 *  7. Write audit log entry
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { participants, stageCompletions, studentSessions, deletionAuditLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  let body: { name?: string; phone?: string } = {};
  try { body = await request.json(); } catch { /* empty body */ }

  const { name: confirmName, phone: confirmPhone } = body;
  if (!confirmName || !confirmPhone) {
    return NextResponse.json(
      { error: 'Name and phone are required for confirmation.' },
      { status: 400 },
    );
  }

  // Find the participant
  const rows = await db
    .select()
    .from(participants)
    .where(eq(participants.id, params.id))
    .limit(1);

  const p = rows[0];
  if (!p) {
    return NextResponse.json({ error: 'Participant not found.' }, { status: 404 });
  }

  if (p.status !== 'cancelled') {
    return NextResponse.json(
      { error: `Participant is not cancelled (current status: ${p.status}). Only cancelled participants can be re-registered.` },
      { status: 409 },
    );
  }

  // Verify name (case-insensitive) and phone match exactly
  const nameMatch = p.name.toLowerCase() === confirmName.trim().toLowerCase();
  const phoneMatch = p.phone === confirmPhone.trim().replace(/\D/g, '');

  if (!nameMatch || !phoneMatch) {
    return NextResponse.json(
      { error: 'Name or phone number does not match. Please enter the exact details to confirm re-registration.' },
      { status: 403 },
    );
  }

  // Reset participant
  await db
    .update(participants)
    .set({
      status: 'active',
      current_stage: 1,
      cancelled_at: null,
      cancel_reason: null,
    })
    .where(eq(participants.id, params.id));

  // Clear old stage completions
  await db
    .delete(stageCompletions)
    .where(eq(stageCompletions.participant_id, params.id));

  // Deactivate any old sessions
  await db
    .update(studentSessions)
    .set({ is_active: false })
    .where(eq(studentSessions.participant_id, params.id));

  // Write audit log
  await db.insert(deletionAuditLog).values({
    participant_name: p.name,
    participant_phone: p.phone,
    stage_at_deletion: p.current_stage,
    action: 'reset_progress',
    performed_by: auth.username,
    extra_info: `Admin re-registered for testing`,
  });

  return NextResponse.json({
    reregistered: true,
    participantId: p.id,
    name: p.name,
    phone: p.phone,
    message: `${p.name} has been re-registered and reset to Stage 1.`,
  });
}
