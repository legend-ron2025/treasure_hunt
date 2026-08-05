import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { generateAndPersistQrCards } from '@/lib/services/qr.service';

export const dynamic = 'force-dynamic';

/**
 * Derive the public base URL from the incoming request.
 * Falls back to NEXT_PUBLIC_BASE_URL env var, then to VERCEL_URL.
 * This ensures QR codes encode the correct absolute URL whether running
 * locally or on Vercel.
 */
function getBaseUrl(request: NextRequest): string {
  // Explicit env override (set on Vercel to your custom domain)
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (envUrl && !envUrl.includes('localhost')) return envUrl.replace(/\/$/, '');

  // Prefer deriving from the incoming request host (works behind proxies and on custom domains)
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  if (host) {
    const cleanedHost = host.replace(/:\\d+$/, '').replace(/\/$/, '');
    const proto = cleanedHost.startsWith('localhost') ? 'http' : 'https';
    return `${proto}://${cleanedHost}`;
  }

  // Fallback to Vercel system env if present
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  // Last resort: localhost
  return 'http://localhost:3000';
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (isAuthError(auth)) return auth;

  const baseUrl = getBaseUrl(request);
  console.log('[QR Generate] Base URL:', baseUrl);

  const results = await generateAndPersistQrCards(baseUrl);
  const generated = results.filter((r) => r.success).length;
  const errors = results.filter((r) => !r.success).map((r) => `${r.type}: ${r.error ?? 'Unknown error'}`);

  if (errors.length > 0) {
    return NextResponse.json(
      { generated, total: results.length, errors, results },
      { status: errors.length === results.length ? 500 : 207 },
    );
  }

  return NextResponse.json({ generated: results.length, total: results.length, results });
}

