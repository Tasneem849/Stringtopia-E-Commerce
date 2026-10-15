import { randomUUID } from 'node:crypto';
import { backendBaseUrl, clearedSessionCookie, fetchBackend, jsonResponse, parseCookie, sameOriginRequest } from '@/lib/serverApi';

export const dynamic = 'force-dynamic';

async function proxy(request, context) {
  const method = request.method.toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return jsonResponse({ message: 'This request method is not supported.' }, 405);
  }
  if (!['GET', 'HEAD'].includes(method) && !sameOriginRequest(request)) {
    return jsonResponse({ message: 'Refresh the page and try again.' }, 403);
  }

  const { path = [] } = await context.params;
  const safePath = path.map((part) => encodeURIComponent(part)).join('/');
  const url = new URL(request.url);
  const token = parseCookie(request, 'st_session');
  const headers = { Accept: request.headers.get('accept') || 'application/json' };
  const contentType = request.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;
  if (token) headers.Authorization = `Bearer ${token}`;

  const init = { method, headers };
  if (!['GET', 'HEAD'].includes(method)) init.body = await request.text();

  try {
    const response = await fetchBackend(`/${safePath}${url.search}`, init, request);
    const responseHeaders = new Headers({
      'Cache-Control': 'no-store',
      'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
    });
    const requestId = response.headers.get('x-request-id');
    if (requestId) responseHeaders.set('X-Request-Id', requestId);
    if (response.status === 401 && token) responseHeaders.append('Set-Cookie', clearedSessionCookie());
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch (error) {
    const requestId = randomUUID();
    console.error(`[${requestId}] Stringtopia API proxy failed for ${method} /${safePath}:`, error.message);
    let localApi = false;
    try { localApi = ['localhost', '127.0.0.1', '::1'].includes(new URL(backendBaseUrl()).hostname); } catch {}
    return jsonResponse({
      code: 'API_UNAVAILABLE',
      requestId,
      message: localApi
        ? 'Stringtopia could not reach the local API. Start the server from the server folder with npm run dev, then try again.'
        : 'Stringtopia’s service is temporarily unreachable. Please check your connection and try again shortly.',
    }, 502, { 'X-Request-Id': requestId });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
