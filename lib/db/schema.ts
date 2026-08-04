/**
 * lib/db/schema.ts
 *
 * Drizzle ORM table definitions for the College Treasure Hunt application.
 * Mirrors the PostgreSQL schema defined in design.md exactly.
 */

import {
  pgTable,
  uuid,
  varchar,
  char,
  smallint,
  boolean,
  text,
  timestamp,
  integer,
  inet,
  index,
  uniqueIndex,
  unique,
  check,
  customType,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─── Custom bytea type ─────────────────────────────────────────────────────────

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// ─── participants ──────────────────────────────────────────────────────────────

export const participants = pgTable(
  'participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    phone: char('phone', { length: 10 }).notNull(),
    /** 'active' | 'completed' | 'cancelled' */
    status: varchar('status', { length: 20 }).notNull().default('active'),
    /** 1–5: current stage; 6 means fully completed */
    current_stage: smallint('current_stage').notNull().default(1),
    registered_at: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    cancelled_at: timestamp('cancelled_at', { withTimezone: true }),
    /** 'dropout_tab_close' | 'dropout_navigation' | 'dropout_inactivity' | 'admin_manual' */
    cancel_reason: varchar('cancel_reason', { length: 20 }),
  },
  (t) => [
    // Partial unique index: case-insensitive name uniqueness only for non-cancelled participants
    uniqueIndex('uq_participant_name')
      .on(sql`LOWER(${t.name})`)
      .where(sql`${t.status} != 'cancelled'`),
    // Partial unique index: phone uniqueness only for non-cancelled participants
    uniqueIndex('uq_participant_phone')
      .on(t.phone)
      .where(sql`${t.status} != 'cancelled'`),
    check('chk_phone', sql`${t.phone} ~ '^\\d{10}$'`),
    check('chk_status', sql`${t.status} IN ('active','completed','cancelled')`),
  ],
);

// ─── student_sessions ─────────────────────────────────────────────────────────

export const studentSessions = pgTable('student_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  participant_id: uuid('participant_id')
    .notNull()
    .references(() => participants.id, { onDelete: 'cascade' }),
  /** SHA-256 hash of the JWT string */
  token_hash: varchar('token_hash', { length: 64 }).notNull().unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  last_active_at: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  is_active: boolean('is_active').notNull().default(true),
});

// ─── stage_completions ────────────────────────────────────────────────────────

export const stageCompletions = pgTable(
  'stage_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participant_id: uuid('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    stage_number: smallint('stage_number').notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.participant_id, t.stage_number),
    check('chk_stage_number', sql`${t.stage_number} BETWEEN 1 AND 5`),
  ],
);

// ─── stages ───────────────────────────────────────────────────────────────────

export const stages = pgTable(
  'stages',
  {
    stage_number: smallint('stage_number').primaryKey(),
    difficulty: varchar('difficulty', { length: 20 }).notNull(),
    puzzle_text: text('puzzle_text').notNull(),
    hint_text: text('hint_text'),
    /** Shown on the Stage_Page AND printed on the QR_Card (NULL for stage 5) */
    word_fragment: varchar('word_fragment', { length: 20 }),
    /** Printed on the QR_Card below the QR image; exactly 6 chars */
    access_code: char('access_code', { length: 6 }).notNull(),
    /** The URL encoded in the physical Puzzle_QR */
    qr_url: text('qr_url').notNull(),
    /** Generated QR_Card PNG blob; null if not yet generated */
    styled_qr_card_png: bytea('styled_qr_card_png'),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_stage_number', sql`${t.stage_number} BETWEEN 1 AND 5`),
  ],
);

// ─── registration_qr (singleton, id=1) ────────────────────────────────────────

export const registrationQr = pgTable('registration_qr', {
  /** Singleton row; only id=1 ever exists */
  id: smallint('id').primaryKey().default(1),
  /** Registration page URL encoded in the Registration_QR */
  qr_url: text('qr_url').notNull(),
  /** Generated PNG blob for the registration QR card */
  styled_qr_png: bytea('styled_qr_png'),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── ban_list ─────────────────────────────────────────────────────────────────

export const banList = pgTable(
  'ban_list',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }),
    phone: char('phone', { length: 10 }),
    added_at: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_ban_not_empty', sql`${t.name} IS NOT NULL OR ${t.phone} IS NOT NULL`),
    index('idx_ban_name').on(sql`LOWER(${t.name})`).where(sql`${t.name} IS NOT NULL`),
    index('idx_ban_phone').on(t.phone).where(sql`${t.phone} IS NOT NULL`),
  ],
);

// ─── event_config (singleton, id=1) ───────────────────────────────────────────

export const eventConfig = pgTable('event_config', {
  /** Singleton row; only id=1 ever exists */
  id: smallint('id').primaryKey().default(1),
  /** NULL means not yet scheduled */
  start_time: timestamp('start_time', { withTimezone: true }),
  /** NULL means not yet scheduled */
  end_time: timestamp('end_time', { withTimezone: true }),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── admin_sessions ───────────────────────────────────────────────────────────

export const adminSessions = pgTable('admin_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 100 }).notNull(),
  token_hash: varchar('token_hash', { length: 64 }).notNull().unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  last_active_at: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  is_active: boolean('is_active').notNull().default(true),
});

// ─── admin_login_attempts ─────────────────────────────────────────────────────

export const adminLoginAttempts = pgTable(
  'admin_login_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ip_address: inet('ip_address').notNull(),
    attempted_at: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
    succeeded: boolean('succeeded').notNull().default(false),
  },
  (t) => [
    index('idx_login_attempts_ip').on(t.ip_address, t.attempted_at),
  ],
);

// ─── admins ───────────────────────────────────────────────────────────────────

export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  /** bcrypt hash; max 72 bytes input */
  password_hash: varchar('password_hash', { length: 72 }).notNull(),
});

// ─── deletion_audit_log ───────────────────────────────────────────────────────

export const deletionAuditLog = pgTable(
  'deletion_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    participant_name: varchar('participant_name', { length: 100 }).notNull(),
    participant_phone: char('participant_phone', { length: 10 }).notNull(),
    /** current_stage value at the time of action (1–6) */
    stage_at_deletion: smallint('stage_at_deletion').notNull(),
    /** 'delete_student' | 'reset_progress' | 'event_reset' */
    action: varchar('action', { length: 20 }).notNull(),
    /** admin username */
    performed_by: varchar('performed_by', { length: 100 }).notNull(),
    performed_at: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),
    /** Optional: e.g. participant count deleted on event reset */
    extra_info: text('extra_info'),
  },
  (t) => [
    index('idx_audit_performed').on(t.performed_at),
  ],
);

// ─── reset_log ────────────────────────────────────────────────────────────────

export const resetLog = pgTable('reset_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  performed_by: varchar('performed_by', { length: 100 }).notNull(),
  performed_at: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),
  participants_deleted: integer('participants_deleted').notNull().default(0),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const participantsRelations = relations(participants, ({ many }) => ({
  studentSessions: many(studentSessions),
  stageCompletions: many(stageCompletions),
}));

export const studentSessionsRelations = relations(studentSessions, ({ one }) => ({
  participant: one(participants, {
    fields: [studentSessions.participant_id],
    references: [participants.id],
  }),
}));

export const stageCompletionsRelations = relations(stageCompletions, ({ one }) => ({
  participant: one(participants, {
    fields: [stageCompletions.participant_id],
    references: [participants.id],
  }),
}));
