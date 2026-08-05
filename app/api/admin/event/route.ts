import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { getEventConfig, updateEventConfig } from '@/lib/services/event.service';
import { updateEventConfigRequestSchema } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;
  try {
    const config = await getEventConfig();
    return NextResponse.json(
      {
        id: config.id,
        startTime: config.start_time,
        endTime: config.end_time,
        updatedAt: config.updated_at,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      },
    );
  } catch (err: any) {
    console.error('[GET /api/admin/event]', err);
    return NextResponse.json({ error: 'Failed to fetch event config.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const parsed = updateEventConfigRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.values(fieldErrors).flat()[0] ?? 'Validation failed.';
    return NextResponse.json({ error: firstError, fieldErrors }, { status: 400 });
  }

  try {
    const startDate = new Date(parsed.data.startTime);
    const endDate = new Date(parsed.data.endTime);

    console.log('[PUT /api/admin/event] Saving:', startDate.toISOString(), '->', endDate.toISOString());

    const config = await updateEventConfig(startDate, endDate);

    console.log('[PUT /api/admin/event] Saved OK:', config.start_time, '->', config.end_time);

    return NextResponse.json({
      id: config.id,
      startTime: config.start_time,
      endTime: config.end_time,
      updatedAt: config.updated_at,
    });
  } catch (err: any) {
    console.error('[PUT /api/admin/event] Error:', err);
    return NextResponse.json({ error: err?.message ?? 'Update failed.' }, { status: 400 });
  }
}
