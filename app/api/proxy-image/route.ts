/**
 * GET /api/proxy-image?url=<encoded-url>
 * Proxies an external image through the app server so mobile browsers
 * don't get blocked by hotlink protection on third-party image hosts.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('Missing url param', { status: 400 });
  }

  // Only allow known safe image hosts
  const allowed = ['i.postimg.cc', 'postimg.cc'];
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }
  if (!allowed.includes(parsed.hostname)) {
    return new NextResponse('Host not allowed', { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        // Fetch without a referrer so postimg doesn't block it
        Referer: '',
        'User-Agent': 'Mozilla/5.0 (compatible; VKM-TH-Proxy/1.0)',
      },
    });

    if (!res.ok) {
      return new NextResponse('Upstream error', { status: res.status });
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return new NextResponse('Failed to fetch image', { status: 502 });
  }
}
