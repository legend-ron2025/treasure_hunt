/**
 * Property 12: Event Window Blocks Access Outside Window
 * Validates: Requirements 3.3, 3.4, 3.5
 *
 * Uses fast-check to verify that getEventStatus() correctly classifies
 * any serverTime relative to a configured event window.
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

// getEventStatus is a pure function but event.service imports lib/db which
// throws at module load time if DATABASE_URL is absent. Mock the db module
// so the pure function can be tested without a live database connection.
vi.mock('../../lib/db', () => ({ db: {} }));

import { getEventStatus } from '../../lib/services/event.service';
import type { EventConfig } from '../../lib/types';

/** Arbitrary that always produces a valid (non-NaN) Date within the given range */
const validDate = (min: Date, max: Date) =>
  fc.date({ min, max }).filter((d) => !isNaN(d.getTime()));

describe('Property 12: Event Window Blocks Access Outside Window', () => {
  it('returns "before" for any time before start_time', () => {
    fc.assert(
      fc.property(
        // Generate a valid event window (start + gap of at least 1 minute)
        validDate(new Date('2020-01-01'), new Date('2030-01-01')),
        fc.integer({ min: 60_000, max: 86_400_000 }), // gap 1min–24h in ms
        fc.integer({ min: 1, max: 86_400_000 }), // how far before start
        (start, gapMs, beforeMs) => {
          const end = new Date(start.getTime() + gapMs);
          const serverTime = new Date(start.getTime() - beforeMs);
          const config: EventConfig = {
            id: 1,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            updated_at: start.toISOString(),
          };
          expect(getEventStatus(serverTime, config)).toBe('before');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns "active" for any time within [start_time, end_time]', () => {
    fc.assert(
      fc.property(
        validDate(new Date('2020-01-01'), new Date('2029-01-01')),
        fc.integer({ min: 120_000, max: 86_400_000 }), // gap >= 2 min
        (start, gapMs) => {
          const end = new Date(start.getTime() + gapMs);
          // Pick a time strictly inside the window
          const insideMs = Math.floor(gapMs / 2);
          const serverTime = new Date(start.getTime() + insideMs);
          const config: EventConfig = {
            id: 1,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            updated_at: start.toISOString(),
          };
          expect(getEventStatus(serverTime, config)).toBe('active');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns "ended" for any time after end_time', () => {
    fc.assert(
      fc.property(
        validDate(new Date('2020-01-01'), new Date('2029-01-01')),
        fc.integer({ min: 60_000, max: 86_400_000 }),
        fc.integer({ min: 1, max: 86_400_000 }),
        (start, gapMs, afterMs) => {
          const end = new Date(start.getTime() + gapMs);
          const serverTime = new Date(end.getTime() + afterMs);
          const config: EventConfig = {
            id: 1,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            updated_at: start.toISOString(),
          };
          expect(getEventStatus(serverTime, config)).toBe('ended');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns "before" when event is not yet configured (null times)', () => {
    fc.assert(
      fc.property(
        validDate(new Date('2000-01-01'), new Date('2040-01-01')),
        (serverTime) => {
          const config: EventConfig = {
            id: 1,
            start_time: null,
            end_time: null,
            updated_at: new Date().toISOString(),
          };
          expect(getEventStatus(serverTime, config)).toBe('before');
        },
      ),
      { numRuns: 100 },
    );
  });
});
