import crypto from 'node:crypto';
import { isIP } from 'node:net';

export function backendBaseUrl() {
  const configured = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const normalized = configured.replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
}

function trustedClientIpHeaders(request) {
  const secret = process.env.RATE_LIMIT_PROXY_SECRET;
  const address = request?.headers.get('x-vercel-forwarded-for')?.trim() || '';
  if (!secret || secret.length < 32 || !isIP(address)) return {};
  const signature = crypto.createHmac('sha256', secret).update(address).digest('hex');
  return {
    'X-Stringtopia-Client-IP': address,
    'X-Stringtopia-Client-IP-Signature': signature,
  };
}

export async function fetchBackend(path, init = {}, sourceRequest) {
  const headers = new Headers(init.headers || {});
  for (const [name, value] of Object.entries(trustedClientIpHeaders(sourceRequest))) headers.set(name, value);
  const response = await fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
    signal: init.signal || AbortSignal.timeout(15000),
  });
  return response;
}

export function parseCookie(request, name) {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!match) return '';
  try { return decodeURIComponent(match.slice(name.length + 1)); } catch { return ''; }
}

export function sameOriginRequest(request) {
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') === 'same-origin';
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export function sessionCookie(token, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `st_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearedSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `st_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function jsonResponse(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
