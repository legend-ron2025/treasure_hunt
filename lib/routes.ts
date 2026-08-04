/**
 * lib/routes.ts
 *
 * Single source of truth for all application routes.
 * Used by:
 *  - /admin/sitemap page (UI rendering)
 *  - GET /api/admin/sitemap (JSON API)
 *  - Any middleware or helper that needs to enumerate routes
 */

export type AccessLevel = 'public' | 'session' | 'admin' | 'internal';
export type RouteCategory = 'student' | 'admin' | 'api-student' | 'api-admin' | 'cron';

export interface RouteDefinition {
  /** The URL path (may contain [param] placeholders matching Next.js conventions) */
  path: string;
  /** Human-readable name for the route */
  name: string;
  /** Grouping category for the sitemap page */
  category: RouteCategory;
  /** Who can access this route */
  access: AccessLevel;
  /** Short description of what this route does */
  description: string;
}

export const ROUTES: RouteDefinition[] = [
  // ── Student-Facing Pages ────────────────────────────────────────────────────
  {
    path: '/',
    name: 'Landing Redirect',
    category: 'student',
    access: 'public',
    description: 'Redirects to /register or current stage if session present; redirects to /countdown outside Event_Window',
  },
  {
    path: '/register',
    name: 'Registration Page',
    category: 'student',
    access: 'public',
    description: 'Student registration form (name + phone); entry point from Registration_QR scan',
  },
  {
    path: '/register/success',
    name: 'Registration Success',
    category: 'student',
    access: 'session',
    description: 'Post-registration screen showing "Now go find QR 1!" and the hint to Stage 1 location',
  },
  {
    path: '/stage/[stage]',
    name: 'Stage Page (1–5)',
    category: 'student',
    access: 'session',
    description: 'Puzzle, word fragment (stages 1–4), hint (stages 1–4), and access code input per stage',
  },
  {
    path: '/qr/scan/[stage]',
    name: 'QR Scanner (2–5)',
    category: 'student',
    access: 'session',
    description: 'In-app camera QR scanner for Puzzle QRs 2–5 (shown after each stage completion)',
  },
  {
    path: '/congratulations',
    name: 'Congratulations Screen',
    category: 'student',
    access: 'session',
    description: 'Winner screen with student name, total elapsed time, rank, and top-10 leaderboard',
  },
  {
    path: '/countdown',
    name: 'Countdown / Event Ended Page',
    category: 'student',
    access: 'public',
    description: 'Pre-event live countdown timer or post-event ended message; re-syncs with server every 60s',
  },

  // ── Admin Panel Pages ───────────────────────────────────────────────────────
  {
    path: '/admin/login',
    name: 'Admin Login',
    category: 'admin',
    access: 'public',
    description: 'Admin authentication form with brute-force lockout protection (5 failures → 15-min block)',
  },
  {
    path: '/admin/dashboard',
    name: 'Dashboard Overview',
    category: 'admin',
    access: 'admin',
    description: 'Live summary count cards (total, active, completed, cancelled, per-stage); polls /api/admin/live every 5s',
  },
  {
    path: '/admin/progress',
    name: 'Live Progress',
    category: 'admin',
    access: 'admin',
    description: 'Per-student animated 5-segment progress bars, per-stage timestamps, live elapsed timer; filter and sort controls',
  },
  {
    path: '/admin/leaderboard',
    name: 'Leaderboard',
    category: 'admin',
    access: 'admin',
    description: 'Ranked finishers table with per-stage completion times and durations; CSV export',
  },
  {
    path: '/admin/content',
    name: 'Content Management',
    category: 'admin',
    access: 'admin',
    description: 'Edit puzzle text, hint text, word fragment, and access code for each of the 5 stages',
  },
  {
    path: '/admin/qr',
    name: 'QR Management',
    category: 'admin',
    access: 'admin',
    description: 'Generate, preview, and download all 6 styled QR card PNGs (1 registration + 5 puzzle)',
  },
  {
    path: '/admin/ban',
    name: 'Ban List',
    category: 'admin',
    access: 'admin',
    description: 'View, add, and remove participant ban entries by name and/or phone number',
  },
  {
    path: '/admin/schedule',
    name: 'Event Scheduling',
    category: 'admin',
    access: 'admin',
    description: 'Set and edit event start/end date-time; reset event with "RESET EVENT" confirmation; view reset history',
  },
  {
    path: '/admin/participants',
    name: 'Participant List',
    category: 'admin',
    access: 'admin',
    description: 'Full participant list; cancel, hard-delete, reset progress actions; bulk-delete; CSV export',
  },
  {
    path: '/admin/audit-log',
    name: 'Audit Log',
    category: 'admin',
    access: 'admin',
    description: 'Read-only log of all student deletions and progress resets with timestamps and admin username',
  },
  {
    path: '/admin/sitemap',
    name: 'Site Map',
    category: 'admin',
    access: 'admin',
    description: 'Full list of all application routes grouped by category, with access level and description',
  },

  // ── Student API Endpoints ───────────────────────────────────────────────────
  {
    path: '/api/time',
    name: 'Server Time',
    category: 'api-student',
    access: 'public',
    description: 'GET — returns server time, event status (before/active/ended), and event start/end times',
  },
  {
    path: '/api/student/register',
    name: 'Register',
    category: 'api-student',
    access: 'public',
    description: 'POST — register student with name and phone; returns JWT on success; rejects duplicates, bans, invalid inputs',
  },
  {
    path: '/api/student/heartbeat',
    name: 'Heartbeat',
    category: 'api-student',
    access: 'session',
    description: 'POST — updates last_active_at to keep session alive (called every 2 minutes by client)',
  },
  {
    path: '/api/student/dropout',
    name: 'Dropout',
    category: 'api-student',
    access: 'session',
    description: 'POST (Beacon API) — cancels session on tab close or navigation away; body: { reason }',
  },
  {
    path: '/api/student/me',
    name: 'Student Info',
    category: 'api-student',
    access: 'session',
    description: 'GET — returns current participant name, current stage, and status',
  },
  {
    path: '/api/student/stage/[n]',
    name: 'Stage Content',
    category: 'api-student',
    access: 'session',
    description: 'GET — returns puzzle text, hint text, word fragment, and difficulty for the requested stage (never returns access code)',
  },
  {
    path: '/api/student/stage/[n]/submit',
    name: 'Submit Access Code',
    category: 'api-student',
    access: 'session',
    description: 'POST — verifies access code for a stage; advances participant to next stage on success',
  },
  {
    path: '/api/student/congratulations',
    name: 'Congratulations Data',
    category: 'api-student',
    access: 'session',
    description: 'GET — returns participant name, total elapsed time, leaderboard rank, and top-10 leaderboard entries',
  },

  // ── Admin API Endpoints ─────────────────────────────────────────────────────
  {
    path: '/api/admin/login',
    name: 'Admin Login',
    category: 'api-admin',
    access: 'public',
    description: 'POST — authenticate admin with username and password; returns admin JWT',
  },
  {
    path: '/api/admin/logout',
    name: 'Admin Logout',
    category: 'api-admin',
    access: 'admin',
    description: 'POST — invalidates admin session (sets is_active = false)',
  },
  {
    path: '/api/admin/live',
    name: 'Live Dashboard',
    category: 'api-admin',
    access: 'admin',
    description: 'GET — full dashboard snapshot (all participants + summary counts + leaderboard + serverTime); polled every 5s',
  },
  {
    path: '/api/admin/event',
    name: 'Event Config',
    category: 'api-admin',
    access: 'admin',
    description: 'GET/PUT — read or update event start/end times; PUT rejects end ≤ start',
  },
  {
    path: '/api/admin/event/reset',
    name: 'Event Reset',
    category: 'api-admin',
    access: 'admin',
    description: 'POST — atomically delete all participants and clear schedule; body must contain { confirm: "RESET EVENT" }',
  },
  {
    path: '/api/admin/reset-log',
    name: 'Reset History',
    category: 'api-admin',
    access: 'admin',
    description: 'GET — history of all past event resets with timestamps, admin username, and participant count deleted',
  },
  {
    path: '/api/admin/stages',
    name: 'All Stages',
    category: 'api-admin',
    access: 'admin',
    description: 'GET — returns all 5 stages including access codes (admin-only)',
  },
  {
    path: '/api/admin/stages/[n]',
    name: 'Update Stage',
    category: 'api-admin',
    access: 'admin',
    description: 'PUT — update puzzle text, hint text, word fragment, and/or access code for a specific stage',
  },
  {
    path: '/api/admin/participants',
    name: 'Participants',
    category: 'api-admin',
    access: 'admin',
    description: 'GET — all participants with stage progress; supports ?status= filter and ?sort= parameter',
  },
  {
    path: '/api/admin/participants/[id]',
    name: 'Delete Participant',
    category: 'api-admin',
    access: 'admin',
    description: 'DELETE — hard-delete a participant and all their data; requires body { confirm: true }',
  },
  {
    path: '/api/admin/participants/bulk',
    name: 'Bulk Delete',
    category: 'api-admin',
    access: 'admin',
    description: 'DELETE — bulk hard-delete multiple participants; body: { ids: string[], confirm: true }',
  },
  {
    path: '/api/admin/participants/[id]/reset',
    name: 'Reset Progress',
    category: 'api-admin',
    access: 'admin',
    description: 'POST — reset a participant\'s stage progress back to Stage 1; clears all stage_completions',
  },
  {
    path: '/api/admin/participants/export.csv',
    name: 'Export Participants CSV',
    category: 'api-admin',
    access: 'admin',
    description: 'GET — CSV export of all participants with name, phone, status, stage, completion timestamps',
  },
  {
    path: '/api/admin/leaderboard',
    name: 'Leaderboard',
    category: 'api-admin',
    access: 'admin',
    description: 'GET — full ranked finisher list ordered by total elapsed time ascending',
  },
  {
    path: '/api/admin/leaderboard/export.csv',
    name: 'Leaderboard CSV',
    category: 'api-admin',
    access: 'admin',
    description: 'GET — CSV export of leaderboard with rank, per-stage times, durations, and totals',
  },
  {
    path: '/api/admin/ban',
    name: 'Ban List',
    category: 'api-admin',
    access: 'admin',
    description: 'GET/POST — list all ban entries or add a new one (name and/or phone; at least one required)',
  },
  {
    path: '/api/admin/ban/[id]',
    name: 'Remove Ban',
    category: 'api-admin',
    access: 'admin',
    description: 'DELETE — remove a specific ban entry by ID',
  },
  {
    path: '/api/admin/qr',
    name: 'QR Status',
    category: 'api-admin',
    access: 'admin',
    description: 'GET — metadata and generation status for all 6 QR codes (1 registration + 5 puzzle)',
  },
  {
    path: '/api/admin/qr/generate',
    name: 'Generate QRs',
    category: 'api-admin',
    access: 'admin',
    description: 'POST — regenerate all 6 styled QR card PNGs with decodability verification',
  },
  {
    path: '/api/admin/qr/registration/download',
    name: 'Download Registration QR',
    category: 'api-admin',
    access: 'admin',
    description: 'GET — stream Registration QR card PNG for download',
  },
  {
    path: '/api/admin/qr/[stage]/download',
    name: 'Download Puzzle QR',
    category: 'api-admin',
    access: 'admin',
    description: 'GET — stream Puzzle QR card PNG for stage 1–5 (includes access code and word fragment in image)',
  },
  {
    path: '/api/admin/audit-log',
    name: 'Audit Log',
    category: 'api-admin',
    access: 'admin',
    description: 'GET — deletion and reset audit log; sortable by timestamp',
  },
  {
    path: '/api/admin/sitemap',
    name: 'Sitemap Data',
    category: 'api-admin',
    access: 'admin',
    description: 'GET — returns the full ROUTES array as JSON',
  },

  // ── Internal / Cron ─────────────────────────────────────────────────────────
  {
    path: '/api/cron/sweep-sessions',
    name: 'Session Sweep Cron',
    category: 'cron',
    access: 'internal',
    description: 'GET — Vercel Cron (every 5 min): cancels student sessions inactive for > 30 minutes',
  },
];

/**
 * Helper: filter routes by category
 */
export function getRoutesByCategory(category: RouteCategory): RouteDefinition[] {
  return ROUTES.filter((r) => r.category === category);
}

/**
 * Helper: filter routes by access level
 */
export function getRoutesByAccess(access: AccessLevel): RouteDefinition[] {
  return ROUTES.filter((r) => r.access === access);
}
