/**
 * lib/types.ts
 *
 * All shared TypeScript interfaces and Zod schemas for domain types and
 * API request/response shapes. This is the single source of truth for
 * the application's data contracts.
 */

import { z } from 'zod';

// ─── Re-usable primitive validators ────────────────────────────────────────────

/** Exactly 10 numeric digits */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, 'Phone number must be exactly 10 digits');

/** 2–100 non-whitespace-only characters */
export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters')
  .refine((v) => v.replace(/\s/g, '').length >= 2, 'Name cannot be entirely whitespace');

/** Exactly 6 alphanumeric characters (case-insensitive) */
export const accessCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{6}$/, 'Access code must be exactly 6 alphanumeric characters');

/** UUID v4 */
export const uuidSchema = z.string().uuid();

/** ISO 8601 date-time string — accepts any valid ISO string including Z suffix */
export const isoDateSchema = z.string().refine(
  (s) => !isNaN(new Date(s).getTime()),
  { message: 'Must be a valid date-time string' }
);

// ─── Domain Types ──────────────────────────────────────────────────────────────

/**
 * Participant status
 */
export type ParticipantStatus = 'active' | 'completed' | 'cancelled';

/**
 * Cancel reason — matches `cancel_reason` column values
 */
export type CancelReason =
  | 'dropout_tab_close'
  | 'dropout_navigation'
  | 'dropout_inactivity'
  | 'admin_manual';

/**
 * A registered participant in the treasure hunt.
 * Maps to the `participants` DB table.
 */
export interface Participant {
  id: string; // UUID
  name: string;
  phone: string; // 10-digit string
  status: ParticipantStatus;
  /** 1–5: which stage the student is currently on; 6 means fully completed */
  current_stage: number;
  registered_at: string; // ISO 8601
  cancelled_at: string | null; // ISO 8601
  cancel_reason: CancelReason | null;
}

/**
 * A single stage in the treasure hunt.
 * Maps to the `stages` DB table.
 */
export interface Stage {
  stage_number: number; // 1–5
  difficulty: string; // e.g. "Medium", "Hard", "Final Boss 🏆"
  puzzle_text: string;
  hint_text: string | null; // null for Stage 5
  word_fragment: string | null; // null for Stage 5
  access_code: string; // 6 alphanumeric chars
  qr_url: string;
  updated_at: string; // ISO 8601
}

/**
 * Stage content visible to students — no access_code exposed.
 */
export interface StageContent {
  stage_number: number;
  difficulty: string;
  puzzle_text: string;
  hint_text: string | null;
  word_fragment: string | null;
}

/**
 * A student session row.
 * Maps to the `student_sessions` DB table.
 */
export interface StudentSession {
  id: string; // UUID
  participant_id: string; // UUID
  /** SHA-256 hash of the JWT string */
  token_hash: string;
  created_at: string; // ISO 8601
  last_active_at: string; // ISO 8601
  is_active: boolean;
}

/**
 * A ban list entry.
 * Maps to the `ban_list` DB table.
 * At least one of `name` or `phone` must be non-null.
 */
export interface BanEntry {
  id: string; // UUID
  name: string | null;
  phone: string | null; // 10-digit string
  added_at: string; // ISO 8601
}

/**
 * Event configuration (singleton row, id = 1).
 * Maps to the `event_config` DB table.
 */
export interface EventConfig {
  id: number; // always 1
  start_time: string | null; // ISO 8601; null = not yet scheduled
  end_time: string | null; // ISO 8601; null = not yet scheduled
  updated_at: string; // ISO 8601
}

/**
 * Event window status from the perspective of the current server time.
 */
export type EventStatus = 'before' | 'active' | 'ended';

/**
 * Stage completion record.
 * Maps to the `stage_completions` DB table.
 */
export interface StageCompletion {
  id: string; // UUID
  participant_id: string; // UUID
  stage_number: number; // 1–5
  completed_at: string; // ISO 8601
}

/**
 * A single row in the leaderboard — fully completed participants.
 */
export interface LeaderboardEntry {
  rank: number;
  name: string;
  phone: string;
  registered_at: string; // ISO 8601
  stage1_at: string | null; // ISO 8601
  stage2_at: string | null;
  stage3_at: string | null;
  stage4_at: string | null;
  stage5_at: string | null;
  /** Duration from registration to stage 1 completion, in seconds */
  stage1_seconds: number | null;
  stage2_seconds: number | null;
  stage3_seconds: number | null;
  stage4_seconds: number | null;
  stage5_seconds: number | null;
  /** Total time from registration to Stage 5 completion, in seconds */
  total_seconds: number;
}

/**
 * Participant row as returned in the admin live dashboard.
 * Includes all completion timestamps and the "entered current stage at" value
 * used by the admin UI for live timer computation.
 */
export interface ParticipantRow {
  id: string; // UUID
  name: string;
  phone: string;
  status: ParticipantStatus;
  current_stage: number;
  registered_at: string; // ISO 8601
  cancelled_at: string | null;
  cancel_reason: CancelReason | null;
  stage1_at: string | null;
  stage2_at: string | null;
  stage3_at: string | null;
  stage4_at: string | null;
  stage5_at: string | null;
  /**
   * The timestamp when the participant entered their current stage.
   * For Stage 1: equals registered_at.
   * For Stage N (N > 1): equals stage(N-1)_at.
   * Used by admin UI to compute live "time on current stage" counter.
   */
  entered_current_stage_at: string; // ISO 8601
}

/**
 * Summary counts used in the admin dashboard header.
 */
export interface DashboardSummary {
  total_registered: number;
  active: number;
  completed: number;
  cancelled: number;
  /** Participant counts keyed by stage number (1–5) */
  by_stage: Record<1 | 2 | 3 | 4 | 5, number>;
}

/**
 * The full snapshot returned by GET /api/admin/live.
 * Used by the admin dashboard polling hook.
 */
export interface DashboardSnapshot {
  summary: DashboardSummary;
  /** All participants, sorted by current_stage DESC then registered_at ASC */
  participants: ParticipantRow[];
  /** Only fully-completed participants, sorted by total_seconds ASC */
  leaderboard: LeaderboardEntry[];
  /** Server-authoritative ISO 8601 timestamp — used for live timer baseline */
  server_time: string;
}

// ─── JWT Payloads ──────────────────────────────────────────────────────────────

/**
 * Student JWT payload (HS256, signed with STUDENT_JWT_SECRET)
 */
export interface StudentJwtPayload {
  /** Subject = participant UUID */
  sub: string;
  iat: number;
  exp: number;
}

/**
 * Admin JWT payload (HS256, signed with ADMIN_JWT_SECRET)
 */
export interface AdminJwtPayload {
  /** Subject = admin UUID */
  sub: string;
  role: 'admin';
  iat: number;
  exp: number;
}

// ─── API Request Schemas ───────────────────────────────────────────────────────

/**
 * POST /api/student/register
 */
export const registerRequestSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/**
 * POST /api/student/stage/[n]/submit
 */
export const submitAccessCodeRequestSchema = z.object({
  accessCode: accessCodeSchema,
});
export type SubmitAccessCodeRequest = z.infer<typeof submitAccessCodeRequestSchema>;

/**
 * POST /api/student/dropout (Beacon API body)
 */
export const dropoutRequestSchema = z.object({
  reason: z.enum(['dropout_tab_close', 'dropout_navigation']),
});
export type DropoutRequest = z.infer<typeof dropoutRequestSchema>;

/**
 * POST /api/admin/login
 */
export const adminLoginRequestSchema = z.object({
  username: z.string().min(4, 'Username must be at least 4 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>;

/**
 * PUT /api/admin/event
 */
export const updateEventConfigRequestSchema = z
  .object({
    startTime: isoDateSchema,
    endTime: isoDateSchema,
  })
  .refine(
    (data) => new Date(data.endTime) > new Date(data.startTime),
    { message: 'End time must be later than start time', path: ['endTime'] },
  )
  .refine(
    (data) =>
      new Date(data.endTime).getTime() - new Date(data.startTime).getTime() >= 60_000,
    {
      message: 'End time must be at least 1 minute after start time',
      path: ['endTime'],
    },
  );
export type UpdateEventConfigRequest = z.infer<typeof updateEventConfigRequestSchema>;

/**
 * PUT /api/admin/stages/[n]
 */
export const updateStageRequestSchema = z
  .object({
    puzzleText: z
      .string()
      .max(2000, 'Puzzle text must be at most 2000 characters')
      .refine((v) => v.trim().length > 0, 'Puzzle cannot be empty'),
    hintText: z.string().max(500, 'Hint text must be at most 500 characters').nullable().optional(),
    wordFragment: z.string().max(20).nullable().optional(),
    accessCode: accessCodeSchema,
  });
export type UpdateStageRequest = z.infer<typeof updateStageRequestSchema>;

/**
 * POST /api/admin/ban
 */
export const addBanEntryRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional().nullable(),
    phone: phoneSchema.optional().nullable(),
  })
  .refine(
    (data) => (data.name && data.name.length > 0) || (data.phone && data.phone.length > 0),
    { message: 'At least one of name or phone number is required' },
  );
export type AddBanEntryRequest = z.infer<typeof addBanEntryRequestSchema>;

/**
 * DELETE /api/admin/participants/:id (hard delete)
 */
export const deleteParticipantRequestSchema = z.object({
  confirm: z.literal(true),
});
export type DeleteParticipantRequest = z.infer<typeof deleteParticipantRequestSchema>;

/**
 * DELETE /api/admin/participants/bulk
 */
export const bulkDeleteParticipantsRequestSchema = z.object({
  ids: z.array(uuidSchema).min(1),
  confirm: z.literal(true),
});
export type BulkDeleteParticipantsRequest = z.infer<typeof bulkDeleteParticipantsRequestSchema>;

/**
 * POST /api/admin/event/reset
 */
export const resetEventRequestSchema = z.object({
  confirm: z.literal('RESET EVENT'),
});
export type ResetEventRequest = z.infer<typeof resetEventRequestSchema>;

// ─── API Response Types ────────────────────────────────────────────────────────

/**
 * Standard error response shape
 */
export interface ErrorResponse {
  error: string;
  /** Field-level validation errors from Zod (optional) */
  fieldErrors?: Record<string, string[]>;
}

/**
 * POST /api/student/register — success
 */
export interface RegisterResponse {
  token: string;
  participantId: string;
  name: string;
  currentStage: number;
}

/**
 * GET /api/student/me
 */
export interface StudentMeResponse {
  participantId: string;
  name: string;
  currentStage: number;
  status: ParticipantStatus;
  cancelReason?: CancelReason;
}

/**
 * GET /api/student/stage/[n]
 */
export interface StageContentResponse {
  stageNumber: number;
  difficulty: string;
  puzzleText: string;
  hintText: string | null;
  wordFragment: string | null;
}

/**
 * POST /api/student/stage/[n]/submit — success payload
 */
export type NextAction =
  | { type: 'scan_qr'; nextStage: number }
  | { type: 'congratulations' };

export interface SubmitAccessCodeResponse {
  success: boolean;
  nextAction?: NextAction;
  error?: string;
}

/**
 * GET /api/student/congratulations
 */
export interface CongratsResponse {
  name: string;
  totalElapsedSeconds: number;
  rank: number;
  leaderboard: LeaderboardEntry[];
}

/**
 * GET /api/time
 */
export interface ServerTimeResponse {
  serverTime: string; // ISO 8601
  eventStatus: EventStatus;
  startTime: string | null; // ISO 8601
  endTime: string | null; // ISO 8601
}

/**
 * POST /api/admin/login — success
 */
export interface AdminLoginResponse {
  token: string;
  adminId: string;
  username: string;
}

/**
 * GET /api/admin/event
 */
export interface AdminEventResponse {
  id: number;
  startTime: string | null; // ISO 8601
  endTime: string | null; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * GET /api/admin/stages — array item
 */
export interface AdminStageResponse {
  stageNumber: number;
  difficulty: string;
  puzzleText: string;
  hintText: string | null;
  wordFragment: string | null;
  accessCode: string;
  qrUrl: string;
  updatedAt: string; // ISO 8601
}

/**
 * GET /api/admin/ban — array item
 */
export interface AdminBanEntryResponse {
  id: string; // UUID
  name: string | null;
  phone: string | null;
  addedAt: string; // ISO 8601
}

/**
 * POST /api/admin/event/reset
 */
export interface ResetEventResponse {
  participantsDeleted: number;
  performedAt: string; // ISO 8601
}

/**
 * GET /api/admin/reset-log — array item
 */
export interface ResetLogEntry {
  id: string; // UUID
  performedBy: string;
  performedAt: string; // ISO 8601
  participantsDeleted: number;
}

/**
 * GET /api/admin/audit-log — array item
 */
export interface AuditLogEntry {
  id: string; // UUID
  participantName: string;
  participantPhone: string;
  stageAtDeletion: number;
  action: 'delete_student' | 'reset_progress' | 'event_reset';
  performedBy: string;
  performedAt: string; // ISO 8601
  extraInfo: string | null;
}

/**
 * GET /api/admin/qr — metadata for a single QR code
 */
export interface QrCodeMeta {
  type: 'registration' | 'puzzle';
  stageNumber: number | null; // null for registration QR
  encodedUrl: string;
  hasImage: boolean;
  accessCode: string | null; // null for registration QR
  wordFragment: string | null; // null for registration QR and Stage 5
  updatedAt: string | null; // ISO 8601; null if never generated
}

/**
 * GET /api/admin/qr — full response
 */
export interface QrStatusResponse {
  qrCodes: QrCodeMeta[];
}
