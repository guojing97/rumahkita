import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_BASE = process.env.INTERNAL_API_URL || 'http://127.0.0.1:4000/api/v1';

async function handleProxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const targetPath = params.path.join('/');
  const search = req.nextUrl.search;
  const targetUrl = `${BACKEND_API_BASE.replace(/\/+$/, '')}/${targetPath}${search}`;

  // 1. Prepare forwarded headers
  const forwardHeaders = new Headers();

  const headersToForward = [
    'authorization',
    'x-household-id',
    'idempotency-key',
    'content-type',
    'accept',
    'user-agent',
    'x-forwarded-for',
    'x-real-ip',
  ];

  for (const headerName of headersToForward) {
    const val = req.headers.get(headerName);
    if (val) forwardHeaders.set(headerName, val);
  }

  // Forward incoming cookies (including refreshToken)
  const incomingCookie = req.headers.get('cookie');
  if (incomingCookie) {
    forwardHeaders.set('cookie', incomingCookie);
  }

  // 2. Prepare payload as ArrayBuffer (avoids stream duplex consumption issues)
  let body: ArrayBuffer | null = null;
  if (!['GET', 'HEAD'].includes(req.method)) {
    if (typeof req.arrayBuffer === 'function') {
      body = await req.arrayBuffer();
    } else if (req.body) {
      // Fallback in case of mock/test environments
      const chunks: Uint8Array[] = [];
      const reader = (req.body as ReadableStream<Uint8Array>).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      body = combined.buffer;
    }
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
      redirect: 'manual',
    });

    // 3. Propagate response headers
    const responseHeaders = new Headers();
    const contentType = upstreamRes.headers.get('content-type');
    if (contentType) responseHeaders.set('content-type', contentType);

    const contentDisposition = upstreamRes.headers.get('content-disposition');
    if (contentDisposition) responseHeaders.set('content-disposition', contentDisposition);

    const retryAfter = upstreamRes.headers.get('retry-after');
    if (retryAfter) responseHeaders.set('retry-after', retryAfter);

    // 4. Securely replicate Set-Cookie headers from upstream NestJS
    const setCookies =
      typeof upstreamRes.headers.getSetCookie === 'function'
        ? upstreamRes.headers.getSetCookie()
        : upstreamRes.headers.get('set-cookie')
          ? [upstreamRes.headers.get('set-cookie')!]
          : [];

    const res = new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: responseHeaders,
    });

    for (const cookieStr of setCookies) {
      res.headers.append('set-cookie', cookieStr);
    }

    return res;
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Tidak dapat terhubung ke server backend RumahKita',
        timestamp: new Date().toISOString(),
        path: `/api/${targetPath}`,
      },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
