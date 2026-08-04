import { NextRequest, NextResponse } from 'next/server';
import { loginAdmin } from '@/lib/services/auth.service';
import { adminLoginRequestSchema } from '@/lib/types';
import type { AdminLoginResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = adminLoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const ip = getClientIp(request);

  try {
    const token = await loginAdmin(parsed.data.username, parsed.data.password, ip);
    // Return the token; client stores in sessionStorage
    const response: AdminLoginResponse = {
      token,
      adminId: '',   // not exposed for security; client only needs the token
      username: parsed.data.username,
    };
    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Login failed.' },
      { status: err?.status ?? 500 },
    );
  }
}
