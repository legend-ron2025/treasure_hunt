/**
 * lib/services/event.service.ts
 *
 * Service layer for event configuration.
 * Handles reading and updating the singleton event_config row (id=1),
 * and computing the current event status relative to a given server time.
 *
 * Requirements: 3.1, 3.2, 3.7
 */

import { db } from '../db';
import { eventConfig } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { EventConfig, EventStatus } from '../types';

// ─── getEventConfig ────────────────────────────────────────────────────────────

/**
 * Fetch the singleton event config row (id = 1).
 * If no row exists yet, returns a default unconfigured shape with null times.
 */
export async function getEventConfig(): Promise<EventConfig> {
  const rows = await db
    .select()
    .from(eventConfig)
    .where(eq(eventConfig.id, 1))
    .limit(1);

  if (rows.length === 0) {
    // Row not yet seeded — return a sensible default
    return {
      id: 1,
      start_time: null,
      end_time: null,
      updated_at: new Date().toISOString(),
    };
  }

  const row = rows[0];
  return {
    id: row.id,
    start_time: row.start_time ? row.start_time.toISOString() : null,
    end_time: row.end_time ? row.end_time.toISOString() : null,
    updated_at: row.updated_at.toISOString(),
  };
}

// ─── updateEventConfig ────────────────────────────────────────────────────────

/**
 * Update the event start and end times.
 *
 * Validation rules:
 *  - endTime must be strictly after startTime
 *  - The gap must be at least 1 minute (60 000 ms)
 *
 * Uses an upsert so the call is idempotent regardless of whether the row
 * already exists.
 *
 * @throws {Error} if the 1-minute gap constraint is not satisfied
 */
export async function updateEventConfig(
  startTime: Date,
  endTime: Date,
): Promise<EventConfig> {
  const gapMs = endTime.getTime() - startTime.getTime();
  if (gapMs < 60_000) {
    throw new Error('End time must be at least 1 minute after start time');
  }

  const now = new Date();

  const rows = await db
    .insert(eventConfig)
    .values({ id: 1, start_time: startTime, end_time: endTime, updated_at: now })
    .onConflictDoUpdate({
      target: eventConfig.id,
      set: {
        start_time: startTime,
        end_time: endTime,
        updated_at: now,
      },
    })
    .returning();

  const row = rows[0];
  return {
    id: row.id,
    start_time: row.start_time ? row.start_time.toISOString() : null,
    end_time: row.end_time ? row.end_time.toISOString() : null,
    updated_at: row.updated_at.toISOString(),
  };
}

// ─── getEventStatus ───────────────────────────────────────────────────────────

/**
 * Determine the event status relative to the given server time.
 *
 * - 'before'  — event has not started yet (or is not yet configured)
 * - 'active'  — current time is within [start_time, end_time]
 * - 'ended'   — current time is past end_time
 *
 * This is a pure function; no DB access needed.
 */
export function getEventStatus(serverTime: Date, config: EventConfig): EventStatus {
  if (!config.start_time || !config.end_time) {
    return 'before';
  }

  const start = new Date(config.start_time);
  const end = new Date(config.end_time);

  if (serverTime < start) return 'before';
  if (serverTime > end) return 'ended';
  return 'active';
}
