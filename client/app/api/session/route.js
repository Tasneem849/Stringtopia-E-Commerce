import { randomUUID } from 'node:crypto';
import {
  clearedSessionCookie,
  backendBaseUrl,
  fetchBackend,
  jsonResponse,
  parseCookie,
  sameOriginRequest,
  sessionCookie,
} from '@/lib/serverApi';

export const dynamic = 'force-dynamic';

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function upstreamUnavailable(error) {
  const requestId = randomUUID();
  console.error(`[${requestId}] Stringtopia auth proxy could not reach the API:`, error.message);
  let localApi = false;
  try { localApi = ['localhost', '127.0.0.1', '::1'].includes(new URL(backendBaseUrl()).hostname); } catch {}
  return jsonResponse({
    code: 'AUTH_SERVICE_UNAVAILABLE',
    requestId,
    message: localApi
      ? 'Stringtopia could not reach the local API. Start the server from the server folder with npm run dev, then try again.'
      : 'Stringtopia’s sign-in service is temporarily unreachable. Check your connection and try again shortly.',
  }, 502, { 'X-Request-Id': requestId });
}

export async function GET(request) {
  const token = parseCookie(request, 'st_session');
  if (!token) return jsonResponse({ user: null });
  try {
    const response = await fetchBackend('/auth/me', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }, request);
    const data = await readJson(response);
    if (response.status === 401 || (response.ok && !data?.id)) {
      return jsonResponse({ user: null }, 200, { 'Set-Cookie': clearedSessionCookie() });
    }
    if (!response.ok) return jsonResponse({ code: 'SESSION_CHECK_FAILED', message: 'Your session could not be checked just now. Please refresh and try again.' }, 503);
    return jsonResponse({ user: data });
  } catch (error) {
    return upstreamUnavailable(error);
  }
}

export async function POST(request) {
  if (!sameOriginRequest(request)) return jsonResponse({ code: 'INVALID_ORIGIN', message: 'Refresh the page and try signing in again.' }, 403);
  let input;
  try { input = await request.json(); } catch { return jsonResponse({ message: 'We couldn’t read the sign-in details. Please try again.' }, 400); }

  if (input?.action === 'exchange') {
    const token = typeof input.token === 'string' && input.token.length <= 2048 ? input.token : '';
    if (!token) return jsonResponse({ user: null }, 401, { 'Set-Cookie': clearedSessionCookie() });
    try {
      const response = await fetchBackend('/auth/me', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }, request);
      const user = await readJson(response);
      if (!response.ok || !user?.id) return jsonResponse({ user: null }, 401, { 'Set-Cookie': clearedSessionCookie() });
      if (user.role === 'admin') {
        return jsonResponse({ user: null, code: 'ADMIN_LOGIN_REQUIRED', message: 'Please sign in again from /admin/login.' }, 401, { 'Set-Cookie': clearedSessionCookie() });
      }
      const maxAge = 7 * 24 * 60 * 60;
      return jsonResponse({ user }, 200, { 'Set-Cookie': sessionCookie(token, maxAge) });
    } catch (error) {
      return upstreamUnavailable(error);
    }
  }

  const endpoint = {
    login: '/auth/login', register: '/auth/register', google: '/auth/google',
    'admin-login': '/auth/admin/login', 'admin-google': '/auth/admin/google',
  }[input?.action];
  if (!endpoint || !input.payload || typeof input.payload !== 'object') {
    return jsonResponse({ message: 'We couldn’t complete sign-in. Refresh the page and try again.' }, 400);
  }

  try {
    const response = await fetchBackend(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(input.payload),
    }, request);
    const data = await readJson(response);
    if (!response.ok) return jsonResponse(data, response.status, { ...(data.requestId ? { 'X-Request-Id': data.requestId } : {}) });
    if (input.action === 'register') {
      return jsonResponse({ message: data.message || 'If an account can be used with these details, you can now try signing in.' }, response.status);
    }
    if (!data.token || !data.user?.id) {
      return jsonResponse({ code: 'INVALID_AUTH_RESPONSE', message: 'Stringtopia returned an incomplete sign-in response. Please try again.' }, 502);
    }
    const adminAuth = ['admin-login', 'admin-google'].includes(input.action);
    if ((adminAuth && data.user.role !== 'admin') || (!adminAuth && data.user.role === 'admin')) {
      return jsonResponse({ code: 'ADMIN_LOGIN_REQUIRED', message: 'Use the separate administrator sign-in at /admin/login.' }, 403);
    }
    const maxAge = data.user.role === 'admin' ? 30 * 60 : 7 * 24 * 60 * 60;
    return jsonResponse({ user: data.user }, response.status, { 'Set-Cookie': sessionCookie(data.token, maxAge) });
  } catch (error) {
    return upstreamUnavailable(error);
  }
}

export async function DELETE(request) {
  if (!sameOriginRequest(request)) return jsonResponse({ message: 'Refresh the page and try again.' }, 403);
  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': clearedSessionCookie() });
}
