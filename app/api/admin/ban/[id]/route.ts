import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { banList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;
  await db.delete(banList).where(eq(banList.id, params.id));
  return NextResponse.json({ deleted: true });
}
