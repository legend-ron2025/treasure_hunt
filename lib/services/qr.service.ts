/**
 * lib/services/qr.service.ts
 * Requirements: 16.2–16.8
 */
import QRCode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';

const QR_SIZE = 1200;
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 1600;

export async function generateQrPng(url: string): Promise<Buffer> {
  const ecLevels: Array<'Q' | 'H' | 'M'> = ['Q', 'H', 'M'];
  let lastError: Error | null = null;

  for (const level of ecLevels) {
    try {
      const qrBuffer = await QRCode.toBuffer(url, {
        type: 'png', width: QR_SIZE, margin: 2,
        color: { dark: '#003087', light: '#ffffff' },
        errorCorrectionLevel: level,
      });

      // Verify decodability
      const { data, info } = await sharp(qrBuffer).raw().toBuffer({ resolveWithObject: true });
      const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      if (result && result.data === url) {
        return qrBuffer;
      }
      throw new Error(`QR decodability check failed for level ${level}`);
    } catch (err: any) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('QR generation failed after 3 attempts');
}

export async function generateQrCard(
  url: string,
  options: {
    collegeName: string;
    accessCode?: string;
    wordFragment?: string;
    label?: string; // e.g. "Scan to Register" for registration QR
  }
): Promise<Buffer> {
  const qrBuffer = await generateQrPng(url);

  // Build card: white background 1200x1600
  const textLines: Array<{ text: string; size: number; y: number; color: string }> = [
    { text: options.collegeName, size: 48, y: 80, color: '#003087' },
    { text: options.label ?? (options.accessCode ? `Code: ${options.accessCode}` : ''), size: 40, y: 1420, color: '#333333' },
  ];
  if (options.wordFragment) {
    textLines.push({ text: `Fragment: ${options.wordFragment}`, size: 36, y: 1480, color: '#666666' });
  }

  // Create card using sharp: white canvas + QR image composited
  const card = sharp({
    create: { width: CARD_WIDTH, height: CARD_HEIGHT, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .png()
    .composite([
      { input: qrBuffer, top: 180, left: 0 },
    ]);

  return card.toBuffer();
}
