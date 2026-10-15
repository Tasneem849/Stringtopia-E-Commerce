export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
export const money = (cents) =>
  new Intl.NumberFormat('en-EG', { style: 'currency', currency: process.env.NEXT_PUBLIC_CURRENCY || 'EGP' }).format(cents / 100);

export const hasSalePrice = (product) =>
  Number.isFinite(product?.salePrice) && Number.isFinite(product?.price) && product.salePrice >= 0 && product.salePrice < product.price;
export const effectivePrice = (product) => hasSalePrice(product) ? product.salePrice : product.price;

function firstValidationMessage(errors) {
  if (!errors || typeof errors !== 'object') return '';
  for (const value of Object.values(errors)) {
    if (Array.isArray(value) && value.length) return String(value[0]);
    if (typeof value === 'string' && value) return value;
    if (value && typeof value === 'object') {
      const nested = firstValidationMessage(value);
      if (nested) return nested;
    }
  }
  return '';
}

function isOrderSubmission(path, method) {
  return method === 'POST' && /^\/orders\/checkout(?:\?|$)/.test(path);
}

function makeError(message, { status, code, requestId, cause, name } = {}) {
  const error = new Error(message, cause ? { cause } : undefined);
  if (status != null) error.status = status;
  if (code) error.code = code;
  if (requestId) error.requestId = requestId;
  if (name) error.name = name;
  return error;
}

function transportError(cause, path, method) {
  if (cause?.name === 'TimeoutError' || cause?.name === 'AbortError') {
    const message = isOrderSubmission(path, method)
      ? 'We couldn’t confirm your order because the request timed out. Check your orders or contact Stringtopia before submitting again.'
      : 'This is taking longer than expected. Please try again in a moment.';
    return makeError(message, { code: 'REQUEST_TIMEOUT', cause, name: cause.name });
  }
  if (cause?.name === 'TypeError') {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const message = offline
      ? 'You appear to be offline. Check your internet connection, then try again.'
      : isOrderSubmission(path, method)
        ? 'We couldn’t confirm your order because the connection was interrupted. Check your orders or contact Stringtopia before submitting again.'
        : 'We couldn’t connect to Stringtopia. Check your internet connection and try again.';
    // Keep the TypeError name so sign-in can add deployment-specific connection guidance.
    return makeError(message, { code: offline ? 'OFFLINE' : 'NETWORK_ERROR', cause, name: 'TypeError' });
  }
  return cause;
}

function messageForResponse(status, data, path, method) {
  const validationMessage = firstValidationMessage(data?.errors);
  if (status === 400 && validationMessage) return validationMessage;
  const serverMessage = data?.message || validationMessage;

  if (status === 408 || status === 504) {
    return isOrderSubmission(path, method)
      ? 'We couldn’t confirm your order because the request timed out. Check your orders or contact Stringtopia before submitting again.'
      : 'The request took too long. Please try again.';
  }
  if (status === 401 && ['Not logged in', 'Invalid or expired token'].includes(serverMessage)) {
    return 'Your session has expired. Please log in again and retry.';
  }
  if (status === 403 && serverMessage === 'Admins only') {
    return 'This area is available to the shop administrator only.';
  }
  if (status === 404 && !serverMessage) {
    return 'We couldn’t find what you were looking for. Refresh the page and try again.';
  }
  if (status >= 500 && status !== 503) {
    if (isOrderSubmission(path, method)) {
      const reference = data?.requestId ? ` Reference: ${data.requestId}.` : '';
      return `We couldn’t confirm your order because the service had a problem. Check your orders or contact Stringtopia before submitting again.${reference}`;
    }
    const reference = data?.requestId ? ` (Reference: ${data.requestId})` : '';
    return `Stringtopia hit a temporary problem. Please try again shortly${reference}.`;
  }
  if (status === 503 && serverMessage) return serverMessage;
  if (serverMessage) return serverMessage;
  if (status === 401) return 'Please log in again to continue.';
  if (status === 403) return 'You don’t have permission to do that.';
  if (status === 404) return 'We couldn’t find what you were looking for. Refresh the page and try again.';
  if (status === 413) return 'That file is too large. Choose a smaller file and try again.';
  if (status === 429) return 'There have been too many attempts. Please wait a little, then try again.';
  if (status >= 500) return 'Stringtopia is temporarily unavailable. Please try again shortly.';
  return 'We couldn’t complete that request. Check the details and try again.';
}

export function friendlyErrorMessage(error, fallback = 'We couldn’t complete that request. Please try again.') {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return 'This is taking longer than expected. Please try again in a moment.';
  }
  if (error?.name === 'TypeError' && !error?.status) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'You appear to be offline. Check your internet connection, then try again.';
    }
    return 'We couldn’t connect to the service. Check your internet connection and try again.';
  }
  return error?.message || fallback;
}

export async function api(path, { token, method = 'GET', body, revalidate, timeoutMs } = {}) {
  const init = {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  };
  if (revalidate != null && method === 'GET' && !token) init.next = { revalidate };
  else init.cache = 'no-store';
  if (timeoutMs) init.signal = AbortSignal.timeout(timeoutMs);
  let res;
  try {
    res = await fetch(API + path, init);
  } catch (cause) {
    throw transportError(cause, path, method);
  }

  let data = null;
  if (res.status !== 204) {
    let raw;
    try {
      raw = await res.text();
    } catch (cause) {
      throw transportError(cause, path, method);
    }
    if (!raw && res.ok) {
      throw makeError('Stringtopia returned an empty response. Please refresh and try again.', {
        status: res.status,
        code: 'INVALID_RESPONSE',
      });
    }
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        if (res.ok) {
          throw makeError('Stringtopia returned an unreadable response. Please refresh and try again.', {
            status: res.status,
            code: 'INVALID_RESPONSE',
          });
        }
      }
    }
  }
  if (!res.ok) {
    const error = makeError(messageForResponse(res.status, data, path, method), {
      status: res.status,
      code: data?.code,
      requestId: data?.requestId,
    });
    if (res.status === 401 && token && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('stringtopia:auth-expired', { detail: { token } }));
    }
    throw error;
  }
  return data;
}

// Cloudinary photos are served resized and in the best format for each browser; other links are left alone.
export const img = (url, width = 800) =>
  url?.includes('res.cloudinary.com') && url.includes('/upload/') ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`) : url;
