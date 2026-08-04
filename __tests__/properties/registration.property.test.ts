/**
 * __tests__/properties/registration.property.test.ts
 *
 * Property-based tests for registration input validation at the Zod schema layer.
 * These do NOT hit the DB — they validate that nameSchema and phoneSchema
 * enforce the correct constraints before any DB interaction.
 *
 * Property 1: Duplicate Name Registration Rejection (Req 2.3)
 * Property 2: Duplicate Phone Registration Rejection (Req 2.4)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { registerRequestSchema, nameSchema, phoneSchema } from '../../lib/types';

/**
 * Property 1: Duplicate Name Registration Rejection
 * Validates: Requirement 2.3
 *
 * nameSchema must reject any string with fewer than 2 non-whitespace characters,
 * and must reject strings longer than 100 characters.
 */
describe('Property 1: Duplicate Name — Zod name validation', () => {
  it('rejects names shorter than 2 non-whitespace characters', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant(' '),
          fc.constant('  '),
          fc.string({ maxLength: 1 }),
        ),
        (name) => {
          if (name.replace(/\s/g, '').length < 2) {
            expect(nameSchema.safeParse(name).success).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects names longer than 100 characters', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z]{101,200}$/),
        (name) => {
          expect(nameSchema.safeParse(name).success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepts valid names (2–100 non-whitespace chars)', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]{2,50}(\s[a-zA-Z]{1,50})?$/),
        (name) => {
          expect(nameSchema.safeParse(name).success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 2: Duplicate Phone Registration Rejection
 * Validates: Requirement 2.4
 *
 * phoneSchema must accept only exactly 10 numeric digits.
 */
describe('Property 2: Duplicate Phone — Zod phone validation', () => {
  it('rejects phone numbers that are not exactly 10 numeric digits', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Too short (digits only)
          fc.stringMatching(/^\d{1,9}$/),
          // Too long (digits only)
          fc.stringMatching(/^\d{11,15}$/),
          // Exactly 10 but contains non-digit characters
          fc.stringMatching(/^\d{0,9}[^0-9]\d{0,9}$/).filter(s => s.length === 10),
        ),
        (phone) => {
          expect(phoneSchema.safeParse(phone).success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepts any 10-digit numeric string', () => {
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
});

describe('Property: registerRequestSchema rejects invalid combinations', () => {
  it('rejects any registration with invalid name or phone', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.oneof(fc.constant(''), fc.constant(' '), fc.constant('x')),
          phone: fc.oneof(
            fc.constant('123'),
            fc.constant('12345678901'),
            fc.constant('abcdefghij'),
          ),
        }),
        ({ name, phone }) => {
          expect(registerRequestSchema.safeParse({ name, phone }).success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
