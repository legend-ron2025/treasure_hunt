import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { getEventConfig, updateEventConfig } from '@/lib/services/event.service';
import { updateEventConfigRequestSchema } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;
  const config = await getEventConfig();
  return NextResponse.json({ id: config.id, startTime: config.start_time, endTime: config.end_time, updatedAt: config.updated_at });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const parsed = updateEventConfigRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'End time must be later than start time.', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  try {
    const config = await updateEventConfig(new Date(parsed.data.startTime), new Date(parsed.data.endTime));
    return NextResponse.json({ id: config.id, startTime: config.start_time, endTime: config.end_time, updatedAt: config.updated_at });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Update failed.' }, { status: 400 });
  }
}
