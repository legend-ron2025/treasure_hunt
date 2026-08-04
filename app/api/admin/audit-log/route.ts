import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { deletionAuditLog } from '@/lib/db/schema';
import { desc, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') === 'asc' ? asc(deletionAuditLog.performed_at) : desc(deletionAuditLog.performed_at);
  const rows = await db.select().from(deletionAuditLog).orderBy(sort);
  return NextResponse.json(rows.map((r) => ({
    id: r.id, participantName: r.participant_name, participantPhone: r.participant_phone,
    stageAtDeletion: r.stage_at_deletion, action: r.action, performedBy: r.performed_by,
    performedAt: r.performed_at.toISOString(), extraInfo: r.extra_info,
  })));
}
