import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { resetLog } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;
  const rows = await db.select().from(resetLog).orderBy(desc(resetLog.performed_at));
  return NextResponse.json(rows.map((r) => ({
    id: r.id, performedBy: r.performed_by,
    performedAt: r.performed_at.toISOString(), participantsDeleted: r.participants_deleted,
  })));
}
