import { db } from '../db';
import { stages, stageCompletions, participants } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { StageContent } from '../types';

/**
 * Fetch stage content for the student view — never returns the access code.
 */
export async function getStageContent(stageNumber: number): Promise<StageContent | null> {
  const rows = await db
    .select({
      stage_number: stages.stage_number,
      difficulty: stages.difficulty,
      puzzle_text: stages.puzzle_text,
      hint_text: stages.hint_text,
      word_fragment: stages.word_fragment,
    })
    .from(stages)
    .where(eq(stages.stage_number, stageNumber))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    stage_number: row.stage_number,
    difficulty: row.difficulty,
    puzzle_text: row.puzzle_text,
    hint_text: row.hint_text ?? null,
    word_fragment: row.word_fragment ?? null,
  };
}

/**
 * Get the full stage row (admin use only — includes access_code).
 */
export async function getStageAdmin(stageNumber: number) {
  const rows = await db
    .select()
    .from(stages)
    .where(eq(stages.stage_number, stageNumber))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Verify an access code for a given stage (case-insensitive).
 * Returns true if the code matches, false otherwise.
 */
export async function verifyAccessCode(
  stageNumber: number,
  code: string,
): Promise<boolean> {
  const rows = await db
    .select({ access_code: stages.access_code })
    .from(stages)
    .where(eq(stages.stage_number, stageNumber))
    .limit(1);

  if (rows.length === 0) return false;
  return rows[0].access_code.toUpperCase() === code.trim().toUpperCase();
}

/**
 * Record stage completion and advance participant to next stage.
 * After stage 5 completes, marks the participant as 'completed'
 * AND immediately ends the event (sets end_time = now) so non-winners
 * get redirected to the event-ended page.
 */
export async function advanceParticipantStage(
  participantId: string,
  stageNumber: number,
): Promise<void> {
  const nextStage = stageNumber + 1; // 6 = fully completed
  const isFinished = stageNumber === 5;

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await db
        .insert(stageCompletions)
        .values({ participant_id: participantId, stage_number: stageNumber })
        .onConflictDoNothing();

      await db
        .update(participants)
        .set({
          current_stage: nextStage,
          ...(isFinished ? { status: 'completed' } : {}),
        })
        .where(
          and(
            eq(participants.id, participantId),
            eq(participants.current_stage, stageNumber),
          ),
        );

      // When stage 5 is completed → immediately end the event so non-winners
      // get redirected to the event-ended page automatically.
      if (isFinished) {
        const { eventConfig } = await import('../db/schema');
        const now = new Date();
        // Only end if event is still active (don't reopen an already-ended event)
        await db
          .update(eventConfig)
          .set({ end_time: now, updated_at: now })
          .where(eq(eventConfig.id, 1));
      }

      return;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
  throw lastError;
}

/**
 * Update stage content (admin).
 */
export async function updateStageContent(
  stageNumber: number,
  data: {
    puzzle_text: string;
    hint_text: string | null;
    word_fragment: string | null;
    access_code: string;
  },
) {
  await db
    .update(stages)
    .set({ ...data, updated_at: new Date() })
    .where(eq(stages.stage_number, stageNumber));
}
