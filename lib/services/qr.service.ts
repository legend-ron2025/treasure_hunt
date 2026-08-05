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
      // Wide box — 1400 wide × 380 tall — plenty of room for two text lines
      const BOX_W  = 1400;
      const BOX_H  = 380;
      const BOX_X  = (CARD_W - BOX_W) / 2;
      const BOX_Y  = QR_BOT + 430;
      const LABEL_Y = BOX_Y + 120;
      const VALUE_Y = BOX_Y + 300;

      bottomSvg += `
        <rect x="${BOX_X}" y="${BOX_Y}"
          width="${BOX_W}" height="${BOX_H}" rx="40"
          fill="#fff8e1" stroke="#f0ad4e" stroke-width="8"/>
        <text x="${CARD_W / 2}" y="${LABEL_Y}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="82" fill="#7d5a00" text-anchor="middle">Remember this word!</text>
        <text x="${CARD_W / 2}" y="${VALUE_Y}"
          font-family="'Courier New', Courier, monospace"
          font-size="160" font-weight="bold"
          fill="#7d5a00" text-anchor="middle" letter-spacing="14">${wordFragment}</text>`;
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
