/**
 * Property 11: Leaderboard Sort Invariant
 * Validates: Requirements 18.4, 18.9
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { LeaderboardEntry } from '../../lib/types';

function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => a.total_seconds - b.total_seconds || a.name.localeCompare(b.name));
}

describe('Property 11: Leaderboard Sort Invariant (Req 18.4, 18.9)', () => {
  it('sorted leaderboard has total_seconds non-decreasing', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ total_seconds: fc.integer({ min: 1, max: 10000 }), name: fc.string({ minLength: 1 }) }), { minLength: 1, maxLength: 20 }),
        (entries) => {
          const full = entries.map((e, i) => ({ ...e, rank: 0, phone: '', registered_at: '', stage1_at: null, stage2_at: null, stage3_at: null, stage4_at: null, stage5_at: null, stage1_seconds: null, stage2_seconds: null, stage3_seconds: null, stage4_seconds: null, stage5_seconds: null }) as LeaderboardEntry);
          const sorted = sortLeaderboard(full);
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].total_seconds).toBeLessThanOrEqual(sorted[i + 1].total_seconds);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ties are broken alphabetically by name', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ name: fc.stringMatching(/^[a-zA-Z]{2,10}$/) }), { minLength: 2, maxLength: 10 }),
        (nameEntries) => {
          const entries = nameEntries.map((e) => ({ total_seconds: 100, name: e.name, rank: 0, phone: '', registered_at: '', stage1_at: null, stage2_at: null, stage3_at: null, stage4_at: null, stage5_at: null, stage1_seconds: null, stage2_seconds: null, stage3_seconds: null, stage4_seconds: null, stage5_seconds: null }) as LeaderboardEntry);
          const sorted = sortLeaderboard(entries);
          for (let i = 0; i < sorted.length - 1; i++) {
            if (sorted[i].total_seconds === sorted[i + 1].total_seconds) {
              expect(sorted[i].name.localeCompare(sorted[i + 1].name)).toBeLessThanOrEqual(0);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
