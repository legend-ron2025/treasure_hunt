# Implementation Plan: College Treasure Hunt

## Overview

Implement the full-stack, mobile-first QR-code treasure hunt web application using Next.js 14 (App Router), Tailwind CSS, Drizzle ORM, and Neon PostgreSQL. The plan is structured in incremental layers: project scaffolding → database → student flow → admin panel → advanced features → QR generation.

---

## Tasks

- [x] 1. Project scaffolding, configuration, and core types
  - Initialise Next.js 14 project with TypeScript strict mode and Tailwind CSS
  - Configure Drizzle ORM with Neon PostgreSQL HTTP driver
  - Set up environment variables (`.env.local`) and `next.config.js` with HSTS/CSP headers
  - Create `lib/routes.ts` with the full `ROUTES` array as the single source of truth for all application routes
  - Define all TypeScript interfaces and Zod schemas for request/response shapes and shared domain types (participant, stage, session, ban entry, event config, dashboard snapshot)
  - Configure `vercel.json` with the Vercel Cron Job entry (`*/5 * * * *` → `/api/cron/sweep-sessions`)
  - _Requirements: 12.4, 12.5, 12.6, 14.4, 21.4_

- [x] 2. Database schema and migrations
  - [x] 2.1 Write Drizzle schema for all tables: `participants`, `student_sessions`, `stage_completions`, `stages`, `registration_qr`, `ban_list`, `event_config`, `admin_sessions`, `admin_login_attempts`, `admins`, `deletion_audit_log`, `reset_log`
    - Include all CHECK constraints, partial unique indexes (`uq_participant_name`, `uq_participant_phone`), and foreign keys with CASCADE
    - Seed the `stages` table with default puzzle/hint/word fragment/access code/difficulty values for all 5 stages and the default event config row (`id = 1`)
    - Seed the `registration_qr` table with the registration URL singleton row
    - _Requirements: 2.3, 2.4, 5.1–5.7, 6.1, 15.1_
  - [x] 2.2 Create DB client module (`lib/db.ts`) using Neon serverless driver with Drizzle and export typed `db` instance
    - _Requirements: 12.6, 15.1_

- [x] 3. College branding shared component
  - [x] 3.1 Implement `CollegeHeader` React component that renders college logo and name text on all student-facing pages
    - Logo sourced from configured URL; omit image slot entirely if URL is null/empty
    - Suppress image slot on load/render failure; display only college name text as sole branding fallback
    - Use `next/image` with `onError` handler; minimum 44×44px tap targets
    - _Requirements: 1.1, 1.2, 1.3, 14.2_
  - [x] 3.2 Write unit tests for `CollegeHeader`
    - Test logo renders when URL is valid; renders name-only when URL is null; renders name-only on image load failure
    - _Requirements: 1.2, 1.3_

- [x] 4. Event scheduling service and server-time API
  - [x] 4.1 Implement `event.service.ts` with functions: `getEventConfig()`, `updateEventConfig()`, `getEventStatus(serverTime)` returning `'before' | 'active' | 'ended'`
    - Enforce the ≥1-minute gap constraint on update; read from `event_config` singleton row
    - _Requirements: 3.1, 3.2, 3.7_
  - [x] 4.2 Implement `GET /api/time` route handler returning `{ serverTime, eventStatus, startTime, endTime }`
    - Server time sourced from `new Date()` (server-authoritative); never trust client timestamps
    - _Requirements: 3.3, 3.4, 3.5, 17.1, 17.4_
  - [x] 4.3 Write property test for event window access control
    - **Property 12: Event Window Blocks Access Outside Window**
    - **Validates: Requirements 3.3, 3.4, 3.5**

- [x] 5. Admin authentication and brute-force protection
  - [x] 5.1 Implement `auth.service.ts`: admin login (bcrypt compare), session create/validate/expire, brute-force tracking against `admin_login_attempts`
    - Lock out IP after 5 consecutive failures within 10 minutes for 15 minutes; return 429 with correct message
    - Admin sessions expire after 8 hours of inactivity; `last_active_at` updated on every admin API request
    - _Requirements: 12.1, 12.2, 12.3, 12.7_
  - [x] 5.2 Implement admin auth middleware (`lib/adminAuth.ts`) that validates admin JWT and checks `is_active`; redirects unauthenticated requests to `/admin/login`
    - _Requirements: 12.1, 12.2_
  - [x] 5.3 Implement `POST /api/admin/login` and `POST /api/admin/logout` route handlers
    - Login returns signed admin JWT; logout sets `is_active = false` in `admin_sessions`
    - _Requirements: 12.1, 12.7_
  - [x] 5.4 Write unit tests for admin auth
    - Test login success/failure, brute-force lockout boundary (exactly 5 failures), session expiry after 8h inactivity
    - _Requirements: 12.1, 12.7_

- [x] 6. Admin login page (UI)
  - [x] 6.1 Build `/admin/login` page with username/password form; submit to `POST /api/admin/login`; store admin JWT in `sessionStorage`; redirect to `/admin/dashboard` on success
    - Display error messages from API (wrong credentials, too many attempts)
    - _Requirements: 12.1, 12.7_

- [x] 7. Student session service and JWT management
  - [x] 7.1 Implement `session.service.ts`: create student JWT (`jose` HS256), validate token + `is_active` flag, update `last_active_at` on heartbeat
    - JWT payload: `{ sub: participantId, iat, exp: +24h }`; signed with `STUDENT_JWT_SECRET`
    - _Requirements: 7.3, 7.4_
  - [x] 7.2 Implement student auth middleware (`lib/studentAuth.ts`): extract Bearer token, verify signature, check `student_sessions.is_active`; return `403 Cancelled` if session inactive
    - _Requirements: 7.6, 7.7_
  - [x] 7.3 Implement `POST /api/student/heartbeat` (updates `last_active_at`) and `POST /api/student/dropout` (beacon endpoint: marks participant cancelled with reason `dropout_tab_close` or `dropout_navigation`)
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 7.4 Implement `GET /api/cron/sweep-sessions` route: query sessions with `last_active_at < NOW() - 30min` and `is_active = true`; call `cancelParticipant` for each
    - Secure with `CRON_SECRET` header check (Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`)
    - _Requirements: 7.3, 7.4, 7.5_

- [ ] 8. Student registration system
  - [x] 8.1 Implement `student.service.ts` — `registerStudent(name, phone)`: validate inputs (Zod), check ban list, check duplicates (case-insensitive), create participant row, create session; all writes in a single DB transaction with rollback on error
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_
  - [x] 8.2 Write property test for duplicate name rejection
    - **Property 1: Duplicate Name Registration Rejection**
    - **Validates: Requirements 2.3**
  - [x] 8.3 Write property test for duplicate phone rejection
    - **Property 2: Duplicate Phone Registration Rejection**
    - **Validates: Requirements 2.4**
  - [x] 8.4 Write property test for ban list blocking registration
    - **Property 3: Ban List Blocks Registration**
    - **Validates: Requirements 2.5, 2.6, 2.7**
  - [x] 8.5 Write property test for registration input validation
    - **Property 4: Registration Input Validation**
    - **Validates: Requirements 2.9, 2.10, 2.7**
  - [x] 8.6 Implement `POST /api/student/register` route handler and `GET /api/student/me` route
    - Returns JWT on success; returns specific error messages on rejection; guards event window (return 403 if event not active)
    - _Requirements: 2.1–2.10, 3.3, 3.5_

- [x] 9. Registration page and success screen (UI)
  - [x] 9.1 Build `/register` page (`RegistrationPage`): name + phone form, client-side validation (2–100 chars name, exactly 10 digits phone), submit to `POST /api/student/register`, display API error messages inline
    - Mobile-first layout; min 44×44px inputs and submit button; no horizontal scroll at 320px
    - Include `CollegeHeader`; redirect existing-session users to their current stage
    - _Requirements: 2.1, 2.9, 2.10, 14.1, 14.2, 14.5_
  - [x] 9.2 Build `/register/success` page (`RegistrationSuccess`): display "Now go find QR 1!" message plus the hint for Stage 1 fetched from `/api/student/stage/1`; wire up heartbeat and dropout beacon listeners
    - `beforeunload` fires `navigator.sendBeacon('/api/student/dropout', ...)` with token
    - `visibilitychange` fires beacon after hidden > 5s
    - _Requirements: 2.8, 4.2, 7.1, 7.2_

- [x] 10. Stage service and access code submission API
  - [x] 10.1 Implement `stage.service.ts`: `getStageContent(stageNumber)`, `verifyAccessCode(stageNumber, code)` (case-insensitive 6-char compare), `advanceParticipantStage(participantId, stageNumber)` with atomic stage_completion insert + `current_stage` update
    - Record server timestamp atomically on stage completion; retry up to 3 times on write failure
    - _Requirements: 5.8, 5.9, 5.10, 5.11, 5.12, 15.2, 15.3, 18.1, 18.2_
  - [x] 10.2 Write property test for access code format validation
    - **Property 6: Access Code Validation (6 Alphanumeric Characters)**
    - **Validates: Requirements 5.8, 6.4**
  - [x] 10.3 Write property test for stage completion idempotency
    - **Property 9: Stage Completion is Idempotent (No Duplicate Records)**
    - **Validates: Requirements 15.3, 15.4**
  - [x] 10.4 Implement `GET /api/student/stage/:stage` route (returns puzzle, hint, word fragment — never access code) and `POST /api/student/stage/:stage/submit` route (verifies code, advances stage or returns error)
    - Server-side stage authorization: reject requests where `requestedStage ≠ participant.currentStage` with the correct messages
    - _Requirements: 4.3, 4.6, 4.7, 4.8, 5.8, 5.9, 5.10_
  - [x] 10.5 Write property test for stage access authorization
    - **Property 5: Stage Access Authorization Invariant**
    - **Validates: Requirements 4.3, 4.6, 4.7**

- [x] 11. Dropout and permanent ineligibility
  - [x] 11.1 Implement `cancelParticipant(participantId, reason)` in `student.service.ts`: set `participants.status = 'cancelled'`, `cancelled_at`, `cancel_reason`; set `student_sessions.is_active = false`; void stage completions
    - Flag name/phone as permanently ineligible (cancelled status acts as the ineligibility marker per the schema design)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 11.2 Write property test for dropout permanent ineligibility
    - **Property 8: Dropout Leads to Permanent Ineligibility**
    - **Validates: Requirements 7.3, 7.4, 7.6**

- [ ] 12. Checkpoint — Ensure all core student API tests pass
  - Ensure all tests pass. Ask the user if questions arise.

- [x] 13. Stage pages and QR scanner (UI)
  - [x] 13.1 Build `/stage/[stage]` page (`StagePage`): fetch stage content from `/api/student/stage/:stage`; display difficulty label, puzzle text, word fragment (stages 1–4), hint (stages 1–4), access code input (6-char alphanumeric client validation); submit to `/api/student/stage/:stage/submit`
    - Display correct inline error messages; on success redirect to `/qr/scan/[nextStage]` (stages 1–4) or `/congratulations` (stage 5)
    - Heartbeat and dropout beacon wired
    - _Requirements: 5.1–5.12, 7.1, 7.2, 14.1, 14.2, 14.5_
  - [x] 13.2 Build `/qr/scan/[stage]` page (`QRScanPage`): integrate `html5-qrcode` library; request camera permission; activate rear-facing camera (fall back to front); decode QR and match against expected stage URL
    - Show camera-denied error; show "Wrong QR code. Please find the correct one." on mismatch; show 60-second no-detect prompt; process decoded value within 2s
    - _Requirements: 4.5, 4.6, 4.7, 4.9, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 14. Congratulations screen and leaderboard data
  - [x] 14.1 Implement `leaderboard.service.ts`: leaderboard query (finishers ordered by `total_seconds ASC`, then name alphabetically for ties); `getCongratsData(participantId)` returning rank + top-10 leaderboard + total elapsed
    - _Requirements: 13.1, 13.3, 13.4, 13.5, 13.6, 18.3, 18.4, 18.5, 18.9_
  - [x] 14.2 Write property test for leaderboard sort invariant
    - **Property 11: Leaderboard Sort Invariant**
    - **Validates: Requirements 18.4, 18.9**
  - [x] 14.3 Implement `GET /api/student/congratulations` route handler; write completion record to DB (retry 3× on failure, always return screen regardless)
    - Guard against duplicate completion record creation
    - _Requirements: 13.1, 13.2, 13.4, 13.5, 15.3_
  - [x] 14.4 Build `/congratulations` page (`CongratsPage`): display student name, total elapsed time (H:MM:SS), leaderboard rank, top-10 leaderboard entries; persist on re-visit without duplicate DB write
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 18.5_

- [x] 15. Countdown / event-ended page (UI)
  - [x] 15.1 Build `/countdown` page (`CountdownPage`): request `/api/time` within 1s of load; display live countdown (days/hours/minutes/seconds updating every second) when before event window; display event-ended message when after window; re-sync with server every 60 seconds; auto-redirect when timer hits zero
    - Show connection-error message if server time request fails or times out after 5s
    - Include `CollegeHeader`; all QR URLs redirect here outside the Event_Window
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

- [x] 16. Admin — event scheduling and participant management APIs
  - [x] 16.1 Implement `GET /api/admin/event` and `PUT /api/admin/event` route handlers; reject end ≤ start with error message; apply new window within 1s for subsequent student requests
    - _Requirements: 3.1, 3.2, 3.7_
  - [x] 16.2 Implement `GET /api/admin/participants` with `?status=` filter and `?sort=` support; `DELETE /api/admin/participants/:id` (manual cancel); `POST /api/admin/participants/:id/reset` (progress reset to stage 1); `DELETE /api/admin/participants/bulk`
    - Manual cancel sets status to 'cancelled'; terminates session; emits dashboard update
    - Progress reset clears `stage_completions` rows and resets `current_stage` to 1; writes audit log
    - _Requirements: 9.9, 9.10, 20.1–20.10_
  - [x] 16.3 Implement hard-delete for student: `DELETE /api/admin/participants/:id` body `{ confirm: true }` — removes participant + cascade; writes `deletion_audit_log`; releases name/phone immediately
    - _Requirements: 20.2, 20.3, 20.4, 20.7_
  - [x] 16.4 Implement `GET /api/admin/participants/export.csv` generating CSV with required columns
    - _Requirements: 15.5_

- [ ] 17. Admin — stage content management API and ban list API
  - [x] 17.1 Implement `GET /api/admin/stages` and `PUT /api/admin/stages/:stage` route handlers; validate puzzle (not empty), hint (not empty for stages 1–4, optional for stage 5), access code (exactly 6 alphanumeric chars)
    - Changes take effect immediately for subsequent student requests
    - _Requirements: 5.12, 6.1, 6.2, 6.3, 6.4, 6.5, 11.1–11.5_
  - [x] 17.2 Write property test for access code update isolation
    - **Property 7: Access Code Update Isolation**
    - **Validates: Requirements 6.3**
  - [x] 17.3 Implement `GET /api/admin/ban`, `POST /api/admin/ban`, `DELETE /api/admin/ban/:id` route handlers; validate at least one of name/phone present; check for duplicate before insert
    - _Requirements: 10.1–10.6_

- [x] 18. Admin — live polling dashboard API
  - [x] 18.1 Implement `GET /api/admin/live` route returning `DashboardSnapshot`: all participants with stage progress and per-stage timestamps, summary counts (total/active/completed/cancelled, count per stage), current leaderboard, and `serverTime`
    - Each participant row includes `enteredCurrentStageAt` for client-side live timer computation
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 19. Admin panel pages — overview, progress dashboard, leaderboard, content (UI)
  - [x] 19.1 Build `/admin/dashboard` page (`DashboardOverview`): summary count cards (total registered, active, completed, cancelled, per-stage counts); poll `/api/admin/live` every 5s with `setInterval`; diff and re-render only changed rows
    - _Requirements: 9.6, 9.8_
  - [x] 19.2 Build `/admin/progress` page (`LiveProgress`): per-student animated progress bar (5 segments; completed = filled; current = pulsing; future = empty); expandable per-stage timestamps; live "time on current stage" counter ticking in HH:MM:SS; filter and sort controls
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 9.8_
  - [x] 19.3 Build `/admin/leaderboard` page (`Leaderboard`): ranked table (rank, name, phone, registration time, stage 1–5 completion times, per-stage durations, total elapsed time); "Export CSV" button; updates live via 5s poll
    - _Requirements: 18.6, 18.8, 18.10_
  - [x] 19.4 Build `/admin/content` page (`ContentManagement`): accordion of 5 stages; editable fields (puzzle text 2000-char limit, hint text 500-char limit, word fragment, access code); client-side validation mirrors server; save per stage
    - _Requirements: 5.12, 6.1–6.5, 11.1–11.5_

- [ ] 20. Admin panel pages — ban list, schedule, participants, audit log (UI)
  - [x] 20.1 Build `/admin/ban` page (`BanList`): table of ban entries with remove buttons; "Add Ban Entry" form (name + phone, at least one required); error messages from API
    - _Requirements: 10.1–10.6_
  - [x] 20.2 Build `/admin/schedule` page (`EventSchedule`): datetime-local inputs pre-populated with saved values; save button with end > start validation; Reset Event section (requires typing "RESET EVENT" exactly); Reset History table
    - _Requirements: 3.1, 3.2, 19.1–19.5_
  - [x] 20.3 Build `/admin/participants` page (`ParticipantList`): full participant list with cancel, delete (confirmation dialog with name + phone), reset progress buttons; bulk-delete checkbox selection; filters and sort
    - _Requirements: 9.7, 9.8, 9.9, 9.10, 20.1–20.10_
  - [x] 20.4 Build `/admin/audit-log` page (`AuditLog`): read-only table of deletion/reset audit entries; sortable by timestamp; filterable
    - _Requirements: 20.7, 20.8_

- [ ] 21. Event reset API
  - [x] 21.1 Implement `POST /api/admin/event/reset` route: require body `{ confirm: "RESET EVENT" }` (case-sensitive exact match); execute atomic DB transaction (delete all participants + cascade, clear event schedule, write reset_log); return participant count deleted
    - _Requirements: 19.1, 19.2, 19.3, 19.4_
  - [x] 21.2 Implement `GET /api/admin/reset-log` route returning history of past resets
    - _Requirements: 19.5_

- [ ] 22. Checkpoint — Ensure admin panel APIs and pages are functional
  - Ensure all tests pass. Ask the user if questions arise.

- [x] 23. QR code generation
  - [x] 23.1 Implement `qr.service.ts`: `generateWithRetry(url)` — generate 1200×1200 QR PNG with `qrcode` (deep blue foreground, Q error correction, margin 2), composite college logo watermark (12% opacity, `blend: multiply`) using `sharp`, composite centred logo overlay (≤28% of QR dimension), verify decodability with `jsqr`; retry up to 3 times adjusting EC level and logo ratio; throw error after 3 failed attempts
    - _Requirements: 16.2, 16.3, 16.4, 16.5_
  - [x] 23.2 Write property test for QR code decode round-trip
    - **Property 10: QR Code Decode Round-Trip**
    - **Validates: Requirements 16.5**
  - [x] 23.3 Implement `qr.service.ts` — QR Card composition: 1200×1600 canvas with college name/logo header, QR image, access code text (Puzzle QRs 1–5), word fragment text (Puzzle QRs 1–4 only), "Scan to Register" label (Registration QR); store PNG BLOB to `stages.styled_qr_card_png` / `registration_qr.styled_qr_png`
    - _Requirements: 16.6, 16.7_
  - [x] 23.4 Implement `POST /api/admin/qr/generate` (regenerate all 6 QR cards), `GET /api/admin/qr` (metadata + generation status), `GET /api/admin/qr/:stage/download` (stream PNG BLOB), `GET /api/admin/qr/registration/download`
    - Auto-generate on first load of QR management page if no QR exists yet; regenerate automatically when access code, word fragment, or URL changes
    - _Requirements: 16.1, 16.7, 16.8_

- [ ] 24. QR management admin page (UI)
  - [x] 24.1 Build `/admin/qr` page (`QRManagement`): grid of 6 QR cards (1 registration + 5 puzzle); each card shows QR preview thumbnail, encoded URL, current access code and word fragment (puzzle QRs), generation status badge, "Download PNG" button; "Generate All" button; error banner on decodability failure
    - _Requirements: 16.1, 16.2, 16.6, 16.7, 16.8_

- [ ] 25. Admin sitemap page and route registry (UI)
  - [x] 25.1 Build `/admin/sitemap` page (`SitemapPage`): import `ROUTES` from `lib/routes.ts`; group by category into four sections (Student-Facing Pages, Admin Panel Pages, Student API Endpoints, Admin API Endpoints); display route path, page name, access level badge, description, count per section and total; link from admin sidebar nav
    - _Requirements: 21.1, 21.2, 21.3, 21.4_
  - [x] 25.2 Implement `GET /api/admin/sitemap` route returning the `ROUTES` array as JSON
    - _Requirements: 21.1, 21.4_

- [x] 26. Landing redirect and navigation wiring
  - [x] 26.1 Implement `/` (`LandingRedirect`): check for active session via `GET /api/student/me`; redirect to current stage if session present; redirect to `/register` otherwise; redirect to `/countdown` if outside Event_Window
    - Wire admin sidebar navigation across all admin pages (links to dashboard, progress, leaderboard, content, QR, ban, schedule, participants, audit-log, sitemap)
    - _Requirements: 3.3, 3.4, 3.5, 4.3_

- [x] 27. Export and leaderboard CSV
  - [x] 27.1 Implement `export.service.ts` with `generateParticipantsCsv()` and `generateLeaderboardCsv()` functions
    - Participants CSV columns: name, phone, status, current stage, stage 1–5 completion timestamps, cancellation timestamp
    - Leaderboard CSV columns: rank, name, phone, registration timestamp, stage 1–5 completion timestamps, stage 1–5 durations (MM:SS), total elapsed time
    - _Requirements: 15.5, 18.10_
  - [x] 27.2 Wire `GET /api/admin/leaderboard/export.csv` route handler
    - _Requirements: 18.10_

- [~] 28. Final checkpoint — Full integration and all tests passing
  - Ensure all tests pass (unit, property-based, integration). Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The design uses TypeScript throughout — all code should be TypeScript strict
- Property tests use `fast-check` v3 with a minimum of 100 iterations per property
- Unit tests use Vitest; DB tests use a test PostgreSQL instance with transaction rollback after each test
- Checkpoints ensure incremental validation at logical milestones
- The `vercel.json` cron config must be in place before deploying session sweep

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2"] },
    { "id": 1, "tasks": ["3.1", "4.1", "5.1", "7.1", "8.1"] },
    { "id": 2, "tasks": ["3.2", "4.2", "4.3", "5.2", "5.3", "7.2", "8.2", "8.3", "8.4", "8.5"] },
    { "id": 3, "tasks": ["5.4", "6.1", "7.3", "7.4", "8.6", "10.1", "11.1"] },
    { "id": 4, "tasks": ["9.1", "9.2", "10.2", "10.3", "10.4", "11.2"] },
    { "id": 5, "tasks": ["10.5", "13.1", "13.2", "14.1", "15.1", "16.1", "16.2", "16.3", "16.4", "17.1", "17.3"] },
    { "id": 6, "tasks": ["14.2", "14.3", "17.2", "18.1", "19.1", "19.2", "20.1", "20.2", "20.3", "20.4", "21.1", "21.2", "23.1"] },
    { "id": 7, "tasks": ["14.4", "19.3", "19.4", "21.2", "23.2", "23.3"] },
    { "id": 8, "tasks": ["23.4", "24.1", "25.1", "25.2", "26.1", "27.1"] },
    { "id": 9, "tasks": ["27.2"] }
  ]
}
```
