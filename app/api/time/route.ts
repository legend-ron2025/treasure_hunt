/**
 * app/api/time/route.ts
 *
 * GET /api/time
 *
 * Returns the authoritative server time, event status, and configured
 * start/end times. This endpoint must NEVER be cached — every request
 * hits the database so schedule changes propagate immediately.
 *
 * Requirements: 3.3, 3.4, 3.5, 17.1, 17.4
 */

import { NextResponse } from 'next/server';
import { getEventConfig, getEventStatus } from '@/lib/services/event.service';
import type { ServerTimeResponse } from '@/lib/types';

// Force dynamic — disable all Next.js static/ISR caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const serverTime = new Date();
    const config = await getEventConfig();
    const eventStatus = getEventStatus(serverTime, config);

    const body: ServerTimeResponse = {
      serverTime: serverTime.toISOString(),
      eventStatus,
      startTime: config.start_time,
      endTime: config.end_time,
    };

    return NextResponse.json(body, {
      headers: {
        // Prevent all caching at every layer: browser, CDN, Vercel edge
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Surrogate-Control': 'no-store',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (err) {
    console.error('[GET /api/time]', err);
    return NextResponse.json(
      { error: 'Failed to fetch server time.' },
      { status: 500 },
    );
  }
}
