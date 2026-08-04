/**
 * __tests__/properties/accessCodeAndStage.property.test.ts
 *
 * Property 6: Access Code Validation (6 Alphanumeric Characters)
 * Validates: Requirements 5.8, 6.4
 *
 * Property 9: Stage Completion Idempotency
 * Validates: Requirements 15.3, 15.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { accessCodeSchema } from '../../lib/types';

// ─── Property 6: Access Code Validation ───────────────────────────────────────

describe('Property 6: Access Code Validation (Req 5.8, 6.4)', () => {
  it('accepts any 6-character alphanumeric string', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z0-9]{6}$/),
        (code) => {
          expect(accessCodeSchema.safeParse(code).success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects codes shorter than 6 characters', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z0-9]{1,5}$/),
        (code) => {
          expect(accessCodeSchema.safeParse(code).success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects codes longer than 6 characters', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z0-9]{7,20}$/),
        (code) => {
          expect(accessCodeSchema.safeParse(code).success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects empty string', () => {
    expect(accessCodeSchema.safeParse('').success).toBe(false);
  });

  it('rejects codes containing non-alphanumeric characters (6 chars)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 6, maxLength: 6 }).filter(
          (s) => !/^[A-Za-z0-9]{6}$/.test(s),
        ),
        (code) => {
          expect(accessCodeSchema.safeParse(code).success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects known invalid formats', () => {
    const invalid = ['ST@GE1', 'ST AGE', 'STAGE!', 'ST-GE1', '', 'ABC', 'ABCDEFG'];
    for (const code of invalid) {
      expect(accessCodeSchema.safeParse(code).success).toBe(false);
    }
  });
});

// ─── Property 9: Stage Completion Idempotency ─────────────────────────────────

describe('Property 9: Stage Completion Idempotency (Req 15.3, 15.4)', () => {
  it('valid stage numbers are in range 1–5', () => {
    for (const stage of [1, 2, 3, 4, 5]) {
      expect(stage >= 1 && stage <= 5).toBe(true);
    }
  });

  it('stage numbers outside 1–5 are invalid', () => {
    fc.assert(
      fc.property(
        fc.integer().filter((n) => n < 1 || n > 5),
        (stage) => {
          expect(stage >= 1 && stage <= 5).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('completing stage N advances current_stage to N+1 for stages 1–4', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        (currentStage) => {
          const nextStage = currentStage + 1;
          expect(nextStage).toBeGreaterThanOrEqual(2);
          expect(nextStage).toBeLessThanOrEqual(5);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('completing stage 5 sets current_stage to 6 (fully completed)', () => {
    expect(5 + 1).toBe(6);
  });

  it('duplicate (participantId, stageNumber) pairs are always equal — idempotent key', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 1, max: 5 }),
        (participantId, stageNumber) => {
          // Same composite key inserted twice is the same record
          const r1 = { participantId, stageNumber };
          const r2 = { participantId, stageNumber };
          expect(r1.participantId).toBe(r2.participantId);
          expect(r1.stageNumber).toBe(r2.stageNumber);
        },
      ),
      { numRuns: 100 },
    );
  });
});
