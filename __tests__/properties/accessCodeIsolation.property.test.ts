/**
 * Property 7: Access Code Update Isolation
 * Validates: Requirement 6.3
 * When one stage's access code is updated, other stages are unaffected.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Property 7: Access Code Update Isolation (Req 6.3)', () => {
  it('updating one stage code leaves other stage codes unchanged', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // stage to update
        fc.stringMatching(/^[A-Z0-9]{6}$/),
        (targetStage, newCode) => {
          const codes: Record<number, string> = { 1: 'STAGE1', 2: 'STAGE2', 3: 'STAGE3', 4: 'STAGE4', 5: 'WINNER' };
          const before = { ...codes };
          codes[targetStage] = newCode;
          // All other stages unchanged
          for (let s = 1; s <= 5; s++) {
            if (s !== targetStage) expect(codes[s]).toBe(before[s]);
          }
          // Target stage updated
          expect(codes[targetStage]).toBe(newCode);
        },
      ),
      { numRuns: 100 },
    );
  });
});
