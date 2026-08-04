import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { banList } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { addBanEntryRequestSchema } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;
  const rows = await db.select().from(banList);
  return NextResponse.json(rows.map((b) => ({
    id: b.id, name: b.name, phone: b.phone, addedAt: b.added_at.toISOString(),
  })));
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const parsed = addBanEntryRequestSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
      ?? parsed.error.flatten().formErrors[0]
      ?? 'At least one of name or phone number is required.';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  // Check for duplicate
  const existing = await db.select().from(banList).where(
    and(
      parsed.data.name ? sql`LOWER(${banList.name}) = LOWER(${parsed.data.name})` : sql`${banList.name} IS NULL`,
      parsed.data.phone ? eq(banList.phone, parsed.data.phone) : sql`${banList.phone} IS NULL`,
    )
  ).limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: 'This entry already exists in the ban list.' }, { status: 409 });
  }

  const [row] = await db.insert(banList).values({ name: parsed.data.name ?? null, phone: parsed.data.phone ?? null }).returning();
  return NextResponse.json({ id: row.id, name: row.name, phone: row.phone, addedAt: row.added_at.toISOString() }, { status: 201 });
}
