/**
 * GET /api/admin/audit-log
 *
 * Returns a comprehensive audit log combining:
 *  - Registration events (from participants table)
 *  - Ban list additions (from ban_list table)
 *  - Stage completion events (from stage_completions table)
 *  - Admin actions: delete / reset / event_reset (from deletion_audit_log table)
 *  - Dropout cancellations (from participants with cancel_reason)
 *
 * Query params:
 *  - type: 'all' | 'registration' | 'ban' | 'stage_completion' | 'dropout' | 'admin_action'
 *  - sort: 'asc' | 'desc' (default: desc)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { participants, banList, stageCompletions, deletionAuditLog } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get('type') ?? 'all';
  const sortDir = searchParams.get('sort') === 'asc' ? 1 : -1;

  // Fetch all data sources in parallel
  const [allParticipants, allBans, allCompletions, allAdminActions] = await Promise.all([
    db.select().from(participants),
    db.select().from(banList),
    db.select().from(stageCompletions),
    db.select().from(deletionAuditLog),
  ]);

  // Participant lookup for stage completions
  const participantMap = new Map(allParticipants.map((p) => [p.id, p]));

  type LogEntry = {
    id: string;
    type: string;
    timestamp: string;
    summary: string;
    detail: string;
    studentName: string | null;
    studentPhone: string | null;
    performedBy: string;
  };

  const entries: LogEntry[] = [];

  // ── 1. Registration events ─────────────────────────────────────────────────
  if (typeFilter === 'all' || typeFilter === 'registration') {
    for (const p of allParticipants) {
      entries.push({
        id: `reg-${p.id}`,
        type: 'registration',
        timestamp: new Date(p.registered_at).toISOString(),
        summary: `Registered`,
        detail: `${p.name} (${p.phone}) registered for the event`,
        studentName: p.name,
        studentPhone: p.phone,
        performedBy: 'student',
      });
    }
  }

  // ── 2. Dropout / cancellation events ──────────────────────────────────────
  if (typeFilter === 'all' || typeFilter === 'dropout') {
    for (const p of allParticipants.filter((p) => p.status === 'cancelled' && p.cancel_reason)) {
      const reasonLabels: Record<string, string> = {
        dropout_tab_close: 'Closed the browser tab',
        dropout_navigation: 'Navigated away from the event',
        dropout_inactivity: 'Timed out due to inactivity',
        admin_manual: 'Manually cancelled by admin',
      };
      const reason = p.cancel_reason ?? 'unknown';
      entries.push({
        id: `dropout-${p.id}`,
        type: 'dropout',
        timestamp: p.cancelled_at ? new Date(p.cancelled_at).toISOString() : new Date(p.registered_at).toISOString(),
        summary: `Dropout`,
        detail: `${p.name} (${p.phone}) — ${reasonLabels[reason] ?? reason}`,
        studentName: p.name,
        studentPhone: p.phone,
        performedBy: reason.startsWith('dropout') ? 'system' : 'admin',
      });
    }
  }

  // ── 3. Ban list additions ──────────────────────────────────────────────────
  if (typeFilter === 'all' || typeFilter === 'ban') {
    for (const b of allBans) {
      const who = [b.name, b.phone].filter(Boolean).join(' / ');
      entries.push({
        id: `ban-${b.id}`,
        type: 'ban',
        timestamp: new Date(b.added_at).toISOString(),
        summary: `Banned`,
        detail: `Ban entry added: ${who}`,
        studentName: b.name ?? null,
        studentPhone: b.phone ?? null,
        performedBy: 'admin',
      });
    }
  }

  // ── 4. Stage completion events ────────────────────────────────────────────
  if (typeFilter === 'all' || typeFilter === 'stage_completion') {
    for (const c of allCompletions) {
      const p = participantMap.get(c.participant_id);
      if (!p) continue;
      const stageNames = ['', 'Binary Decoder', 'Mirror Text', 'Password Challenge', 'Caesar Cipher', 'Final Boss'];
      const stageName = stageNames[c.stage_number] ?? `Stage ${c.stage_number}`;
      entries.push({
        id: `completion-${c.id}`,
        type: 'stage_completion',
        timestamp: new Date(c.completed_at).toISOString(),
        summary: `Stage ${c.stage_number} Completed`,
        detail: `${p.name} (${p.phone}) completed Stage ${c.stage_number}: ${stageName}`,
        studentName: p.name,
        studentPhone: p.phone,
        performedBy: 'student',
      });
    }
  }

  // ── 5. Admin actions (delete / reset / event_reset) ───────────────────────
  if (typeFilter === 'all' || typeFilter === 'admin_action') {
    for (const a of allAdminActions) {
      const actionLabels: Record<string, string> = {
        delete_student: 'Deleted student',
        reset_progress: 'Reset progress',
        event_reset: 'Event reset',
        dropout_tab_close: 'Auto-cancelled (tab close)',
        dropout_navigation: 'Auto-cancelled (navigation)',
        dropout_inactivity: 'Auto-cancelled (inactivity)',
      };
      entries.push({
        id: `admin-${a.id}`,
        type: a.action.startsWith('dropout') ? 'dropout' : 'admin_action',
        timestamp: new Date(a.performed_at).toISOString(),
        summary: actionLabels[a.action] ?? a.action,
        detail: `${a.participant_name} (${a.participant_phone}) — Stage ${a.stage_at_deletion} at time of action${a.extra_info ? `. ${a.extra_info}` : ''}`,
        studentName: a.participant_name,
        studentPhone: a.participant_phone,
        performedBy: a.performed_by,
      });
    }
  }

  // ── Sort by timestamp ─────────────────────────────────────────────────────
  entries.sort((a, b) => {
    const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    return diff * sortDir;
  });

  return NextResponse.json(entries, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
