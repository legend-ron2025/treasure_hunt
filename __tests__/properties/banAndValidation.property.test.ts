/**
 * __tests__/properties/banAndValidation.property.test.ts
 *
 * Property-based tests for ban list input validation and registration input
 * validation, exercised purely at the schema (Zod) layer.
 *
 * **Validates: Requirements 2.5, 2.6, 2.7, 2.9, 2.10**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { registerRequestSchema, nameSchema, phoneSchema } from '../../lib/types';

// ─── Property 3: Ban List — input validation layer (schema-level) ─────────────

describe('Property 3: Ban List — input validation layer (schema-level)', () => {
  // These test what the Zod layer catches before ban list is even checked.
  // The actual ban list DB behavior is integration-tested separately.

  it('name schema rejects all-whitespace names', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length === 0 || s.replace(/\s/g,'').length < 2),
        (name) => {
          const result = nameSchema.safeParse(name);
          // If the name has fewer than 2 non-whitespace chars, it must be rejected
          if (name.replace(/\s/g, '').length < 2) {
            expect(result.success).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('name schema caps at 100 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 101, maxLength: 200 }).filter(s => s.replace(/\s/g,'').length >= 2),
        (name) => {
          const result = nameSchema.safeParse(name);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 4: Registration Input Validation (Req 2.9, 2.10) ───────────────

describe('Property 4: Registration Input Validation (Req 2.9, 2.10)', () => {
  it('phone must be exactly 10 numeric digits — rejects any other format', () => {
    const invalidPhones = [
      '+1234567890', '123-456-7890', '(123) 456-7890',
      '12345678', '123456789012', 'abcdefghij', '1234 56789',
    ];
    for (const phone of invalidPhones) {
      expect(phoneSchema.safeParse(phone).success).toBe(false);
    }
  });

  it('phone accepts any 10-digit numeric string', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{10}$/),
        (phone) => {
          expect(phoneSchema.safeParse(phone).success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('name rejects strings shorter than 2 chars', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 1 }),
        (name) => {
          const result = nameSchema.safeParse(name);
          // Single char or empty — always invalid
          if (name.replace(/\s/g, '').length < 2) {
            expect(result.success).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('name rejects strings longer than 100 chars', () => {
    fc.assert(
      fc.property(
        // Generate a string of 101–300 non-whitespace characters so trim() can't shorten it below 101
        fc.stringMatching(/^[A-Za-z]{101,300}$/),
        (name) => {
          expect(nameSchema.safeParse(name).success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('valid name+phone pair always passes schema', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z]{2,50}( [A-Za-z]{2,30})?$/),
        fc.stringMatching(/^\d{10}$/),
        (name, phone) => {
          const result = registerRequestSchema.safeParse({ name, phone });
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
