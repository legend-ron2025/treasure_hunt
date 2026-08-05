/**
 * lib/services/qr.service.ts
 *
 * Generates an A4-sized (2480×3508 @ 300 DPI) styled QR card as an SVG.
 *
 * The college logo is fetched and embedded as a faded watermark BEHIND the QR
 * at 15% opacity (60% of QR size, centred).
 *
 * Bottom layout after QR:
 *   - "Access Code" label + large monospace value
 *   - Wide yellow box: "Remember this word!" + large fragment value
 */

import QRCode from 'qrcode';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import {
  stages,
  registrationQr,
  stageQrHistory,
  registrationQrHistory,
} from '@/lib/db/schema';

const CARD_W = 2480;
const CARD_H = 3508;
const QR_SIZE = 1800;
const QR_X   = Math.floor((CARD_W - QR_SIZE) / 2);   // 340
const QR_Y   = 420;
const QR_BOT  = QR_Y + QR_SIZE;                       // 2220

const LOGO_URL = 'https://i.postimg.cc/c1cHCbHX/Whats-App-Image-2026-07-31-at-6-24-50-PM.jpg';

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL, { cache: 'force-cache' });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct  = res.headers.get('content-type') ?? 'image/jpeg';
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function generateQrCard(
  url: string,
  options: {
    collegeName: string;
    accessCode?: string;
    wordFragment?: string;
    isRegistration?: boolean;
  },
): Promise<Buffer> {
  // 1. Generate QR as base64 data-URL
  const qrDataUrl: string = await QRCode.toDataURL(url, {
    type: 'image/png',
    width: QR_SIZE,
    margin: 2,
    color: { dark: '#003087', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });

  // 2. Fetch college logo for watermark (best-effort, non-blocking)
  const logoDataUrl = await fetchLogoDataUrl();

  const collegeName  = esc(options.collegeName);
  const accessCode   = options.accessCode   ? esc(options.accessCode)   : null;
  const wordFragment = options.wordFragment ? esc(options.wordFragment) : null;
  const isReg        = options.isRegistration === true;

  // ── Logo watermark (behind QR) ───────────────────────────────────────────
  const LOGO_SIZE = Math.floor(QR_SIZE * 0.60);   // 1080 px
  const LOGO_X    = QR_X + Math.floor((QR_SIZE - LOGO_SIZE) / 2);
  const LOGO_Y    = QR_Y + Math.floor((QR_SIZE - LOGO_SIZE) / 2);

  const logoSvg = logoDataUrl
    ? `<image href="${logoDataUrl}"
         x="${LOGO_X}" y="${LOGO_Y}"
         width="${LOGO_SIZE}" height="${LOGO_SIZE}"
         preserveAspectRatio="xMidYMid meet"
         opacity="0.15"/>`
    : '';

  // ── Bottom content ────────────────────────────────────────────────────────
  let bottomSvg = '';

  if (isReg) {
    bottomSvg = `
      <text x="${CARD_W / 2}" y="${QR_BOT + 200}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="110" font-weight="bold"
        fill="#003087" text-anchor="middle">Scan to Register</text>`;
  } else {
    if (accessCode) {
      bottomSvg += `
        <text x="${CARD_W / 2}" y="${QR_BOT + 110}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="80" fill="#666666" text-anchor="middle">Access Code</text>
        <text x="${CARD_W / 2}" y="${QR_BOT + 320}"
          font-family="'Courier New', Courier, monospace"
          font-size="210" font-weight="bold"
          fill="#111111" text-anchor="middle" letter-spacing="18">${accessCode}</text>
        <line x1="${CARD_W / 2 - 600}" y1="${QR_BOT + 380}"
              x2="${CARD_W / 2 + 600}" y2="${QR_BOT + 380}"
          stroke="#cccccc" stroke-width="5"/>`;
    }

    if (wordFragment) {
      const BOX_W = 1400;
      const BOX_PADDING = 120;
      const EST_CHAR_WIDTH = 108;
      const maxChars = Math.max(8, Math.floor((BOX_W - BOX_PADDING) / EST_CHAR_WIDTH));

      const wrappedWords = (() => {
        const parts = wordFragment.split(/\s+/);
        const lines: string[] = [];
        let current = '';

        for (const part of parts) {
          if (!current) {
            current = part;
            continue;
          }

          if (current.length + 1 + part.length <= maxChars) {
            current += ` ${part}`;
          } else {
            lines.push(current);
            if (part.length <= maxChars) {
              current = part;
            } else {
              let start = 0;
              while (start < part.length) {
                lines.push(part.slice(start, start + maxChars));
                start += maxChars;
              }
              current = '';
            }
          }
        }

        if (current) lines.push(current);
        return lines.length === 0 ? [wordFragment] : lines;
      })();

      const lineCount = wrappedWords.length;
      const textFontSize = lineCount === 1 ? 160 : lineCount === 2 ? 140 : lineCount === 3 ? 120 : 100;
      const textLetterSpacing = lineCount === 1 ? 14 : 10;
      const lineHeight = Math.round(textFontSize * 1.15);
      const BOX_H = 240 + lineCount * lineHeight;
      const BOX_X = (CARD_W - BOX_W) / 2;
      const BOX_Y = QR_BOT + 430;
      const LABEL_Y = BOX_Y + 115;
      const VALUE_START_Y = BOX_Y + 190;

      const valueLines = wrappedWords
        .map((line, index) => `
          <tspan x="${CARD_W / 2}" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`)
        .join('');

      bottomSvg += `
        <rect x="${BOX_X}" y="${BOX_Y}"
          width="${BOX_W}" height="${BOX_H}" rx="40"
          fill="#fff8e1" stroke="#f0ad4e" stroke-width="8"/>
        <text x="${CARD_W / 2}" y="${LABEL_Y}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="82" fill="#7d5a00" text-anchor="middle">Remember this word!</text>
        <text x="${CARD_W / 2}" y="${VALUE_START_Y}"
          font-family="'Courier New', Courier, monospace"
          font-size="${textFontSize}" font-weight="bold"
          fill="#7d5a00" text-anchor="middle" letter-spacing="${textLetterSpacing}">
          ${valueLines}
        </text>`;
    }
  }

  // ── Build SVG ────────────────────────────────────────────────────────────
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
  <rect width="${CARD_W}" height="${CARD_H}" fill="white"/>
  <rect x="0" y="0" width="${CARD_W}" height="22" fill="#003087"/>
  <text x="${CARD_W / 2}" y="215"
    font-family="Arial, Helvetica, sans-serif" font-size="110" font-weight="bold"
    fill="#003087" text-anchor="middle">${collegeName}</text>
  <text x="${CARD_W / 2}" y="335"
    font-family="Arial, Helvetica, sans-serif" font-size="62" fill="#666666"
    text-anchor="middle">Treasure Hunt Event</text>
  ${logoSvg}
  <image href="${qrDataUrl}" x="${QR_X}" y="${QR_Y}"
    width="${QR_SIZE}" height="${QR_SIZE}" image-rendering="crisp-edges"/>
  ${bottomSvg}
  <rect x="0" y="${CARD_H - 22}" width="${CARD_W}" height="22" fill="#003087"/>
</svg>`;

  return Buffer.from(svg, 'utf-8');
}

async function tryInsertHistory<T>(insertFn: () => Promise<T>, description: string) {
  try {
    await insertFn();
  } catch (err: any) {
    console.warn(`[QR Service] ${description} history insert failed; continuing.`, err?.message ?? err);
  }
}

export type GenerateQrResults = Array<{
  type: string;
  url: string;
  success: boolean;
  error?: string;
}>;

export async function generateAndPersistQrCards(baseUrl: string): Promise<GenerateQrResults> {
  const results: GenerateQrResults = [];
  const collegeName = 'RJMMsVishwakamal Mahavidhayal';

  // Registration QR
  try {
    const registrationUrl = `${baseUrl}/register`;
    const registrationCard = await generateQrCard(registrationUrl, {
      collegeName,
      isRegistration: true,
    });

    await tryInsertHistory(
      () => db.insert(registrationQrHistory).values({ qr_url: registrationUrl, styled_qr_png: registrationCard }),
      'Registration QR',
    );

    await db
      .insert(registrationQr)
      .values({ id: 1, qr_url: registrationUrl, styled_qr_png: registrationCard, updated_at: new Date() })
      .onConflictDoUpdate({
        target: registrationQr.id,
        set: { qr_url: registrationUrl, styled_qr_png: registrationCard, updated_at: new Date() },
      });

    results.push({ type: 'registration', url: registrationUrl, success: true });
  } catch (err: any) {
    results.push({ type: 'registration', url: `${baseUrl}/register`, success: false, error: String(err?.message ?? err) });
  }

  const allStages = await db.select().from(stages).orderBy(stages.stage_number);

  for (const stageRow of allStages) {
    try {
      const stageUrl = `${baseUrl}/stage/${stageRow.stage_number}`;
      const stageCard = await generateQrCard(stageUrl, {
        collegeName,
        accessCode: stageRow.access_code,
        wordFragment: stageRow.word_fragment ?? undefined,
      });

      await tryInsertHistory(
        () =>
          db.insert(stageQrHistory).values({
            stage_number: stageRow.stage_number,
            qr_url: stageUrl,
            styled_qr_card_png: stageCard,
          }),
        `Stage ${stageRow.stage_number} QR`,
      );

      await db
        .update(stages)
        .set({ styled_qr_card_png: stageCard, qr_url: stageUrl, updated_at: new Date() })
        .where(eq(stages.stage_number, stageRow.stage_number));

      results.push({ type: `stage-${stageRow.stage_number}`, url: stageUrl, success: true });
    } catch (err: any) {
      results.push({ type: `stage-${stageRow.stage_number}`, url: `${baseUrl}/stage/${stageRow.stage_number}`, success: false, error: String(err?.message ?? err) });
    }
  }

  return results;
}
