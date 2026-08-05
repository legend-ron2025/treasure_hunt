/**
 * lib/services/event.service.ts
 *
 * Service layer for event configuration.
 * Requirements: 3.1, 3.2, 3.7
 */

import { db } from '../db';
import { eventConfig } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { EventConfig, EventStatus } from '../types';

// ─── getEventConfig ────────────────────────────────────────────────────────────

export async function getEventConfig(): Promise<EventConfig> {
  const rows = await db
    .select()
    .from(eventConfig)
    .where(eq(eventConfig.id, 1))
    .limit(1);

  if (rows.length === 0) {
    return { id: 1, start_time: null, end_time: null, updated_at: new Date().toISOString() };
  }

  const row = rows[0];
  return {
    id: row.id,
    start_time: row.start_time ? new Date(row.start_time).toISOString() : null,
    end_time: row.end_time ? new Date(row.end_time).toISOString() : null,
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// ─── updateEventConfig ────────────────────────────────────────────────────────

export async function updateEventConfig(
  startTime: Date,
  endTime: Date,
): Promise<EventConfig> {
  const gapMs = endTime.getTime() - startTime.getTime();
  if (gapMs < 60_000) {
    throw new Error('End time must be at least 1 minute after start time');
  }

  const now = new Date();

  // Use a raw SQL upsert to bypass any driver-level caching and ensure
  // the DB-level CHECK constraint is satisfied. We do an UPDATE first
  // because the row always exists after seeding; fall back to INSERT.
  const rows = await db
    .insert(eventConfig)
    .values({
      id: 1,
      start_time: startTime,
      end_time: endTime,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: eventConfig.id,
      set: {
        start_time: startTime,
        end_time: endTime,
        updated_at: now,
      },
    })
    .returning();

  if (!rows || rows.length === 0) {
    throw new Error('Database did not return updated row — upsert may have failed silently');
  }

  const row = rows[0];
  return {
    id: row.id,
    start_time: row.start_time ? new Date(row.start_time).toISOString() : null,
    end_time: row.end_time ? new Date(row.end_time).toISOString() : null,
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// ─── getEventStatus ───────────────────────────────────────────────────────────

export function getEventStatus(serverTime: Date, config: EventConfig): EventStatus {
  if (!config.start_time || !config.end_time) return 'before';

  const start = new Date(config.start_time);
  const end = new Date(config.end_time);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'before';
  if (serverTime < start) return 'before';
  if (serverTime > end) return 'ended';
  return 'active';
}
