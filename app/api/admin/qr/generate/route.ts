import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, isAuthError } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { stages, registrationQr, stageQrHistory, registrationQrHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateQrCard } from '@/lib/services/qr.service';

export const dynamic = 'force-dynamic';

const COLLEGE_NAME = 'RJMMsVishwakamal Mahavidhayal';

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

  const errors: string[] = [];
  const results: { type: string; url: string; success: boolean }[] = [];

  // ── Registration QR ───────────────────────────────────────────────────────
  try {
    const url = `${baseUrl}/register`;
    console.log('[QR Generate] Registration QR URL:', url);
    const card = await generateQrCard(url, {
      collegeName: COLLEGE_NAME,
      isRegistration: true,
    });
    // Insert a history record so previous generated cards are preserved
    await db.insert(registrationQrHistory).values({ qr_url: url, styled_qr_png: card });
    // Update current registration QR pointer
    await db
      .update(registrationQr)
      .set({ styled_qr_png: card, qr_url: url, updated_at: new Date() })
      .where(eq(registrationQr.id, 1));
    results.push({ type: 'registration', url, success: true });
    console.log('[QR Generate] Registration QR: OK');
  } catch (e: any) {
    const msg = `Registration QR: ${e?.message ?? String(e)}`;
    errors.push(msg);
    console.error('[QR Generate]', msg);
  }

  // ── Puzzle QRs 1–5 ───────────────────────────────────────────────────────
  const allStages = await db.select().from(stages).orderBy(stages.stage_number);

  for (const s of allStages) {
    try {
      // Always use the absolute URL based on the current host
      const url = `${baseUrl}/stage/${s.stage_number}`;
      console.log(`[QR Generate] Stage ${s.stage_number} QR URL:`, url);
      const card = await generateQrCard(url, {
        collegeName: COLLEGE_NAME,
        accessCode: s.access_code,
        wordFragment: s.word_fragment ?? undefined,
      });
      // Preserve previous card in history before updating
      await db.insert(stageQrHistory).values({ stage_number: s.stage_number, qr_url: url, styled_qr_card_png: card });
      await db
        .update(stages)
        .set({ styled_qr_card_png: card, qr_url: url, updated_at: new Date() })
        .where(eq(stages.stage_number, s.stage_number));
      results.push({ type: `stage-${s.stage_number}`, url, success: true });
      console.log(`[QR Generate] Stage ${s.stage_number} QR: OK`);
    } catch (e: any) {
      const msg = `Stage ${s.stage_number} QR: ${e?.message ?? String(e)}`;
      errors.push(msg);
      console.error('[QR Generate]', msg);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { generated: results.filter((r) => r.success).length, total: 6, errors, results },
      { status: errors.length === 6 ? 500 : 207 },
    );
  }

  return NextResponse.json({ generated: 6, total: 6, results });
}
