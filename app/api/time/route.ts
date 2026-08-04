/**
 * app/api/time/route.ts
 *
 * GET /api/time
 *
 * Returns the authoritative server time along with the current event status
 * and configured start/end times. Clients must use this endpoint for all
 * time-sensitive decisions — client clocks are never trusted.
 *
 * Requirements: 3.3, 3.4, 3.5, 17.1, 17.4
 */

import { NextResponse } from 'next/server';
import { getEventConfig, getEventStatus } from '@/lib/services/event.service';
import type { ServerTimeResponse } from '@/lib/types';

// Disable Next.js static caching — every request must hit the server.
export const dynamic = 'force-dynamic';

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

    return NextResponse.json(body);
  } catch (err) {
    console.error('[GET /api/time]', err);
    return NextResponse.json({ error: 'Failed to fetch server time.' }, { status: 500 });
  }
}
