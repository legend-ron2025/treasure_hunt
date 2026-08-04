import { NextRequest, NextResponse } from 'next/server';
import { registerStudent } from '@/lib/services/student.service';
import { getEventConfig, getEventStatus } from '@/lib/services/event.service';
import { registerRequestSchema } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Guard event window
  const config = await getEventConfig();
  const status = getEventStatus(new Date(), config);
  if (status !== 'active') {
    return NextResponse.json(
      { error: status === 'before' ? 'The event has not started yet.' : 'The event has ended.' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = registerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await registerStudent(parsed.data.name, parsed.data.phone);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Registration failed.' },
      { status: err?.status ?? 500 },
    );
  }
}
