import { API } from '@/lib/api';

export function describeAuthError(error, mode) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      title: 'You appear to be offline',
      message: 'Check your internet connection, then try again.',
      retryable: true,
    };
  }

  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return {
      title: 'The sign-in service took too long to respond',
      message: 'The request timed out. Please try again in a moment.',
      retryable: true,
    };
  }

  if (!error?.status && error?.name === 'TypeError') {
    let apiUrl;
    try { apiUrl = new URL(API); } catch {}

    const localHosts = ['localhost', '127.0.0.1', '::1'];
    const isLocalApi = apiUrl && localHosts.includes(apiUrl.hostname);
    const isHostedPage = typeof window !== 'undefined' && !localHosts.includes(window.location.hostname);

    if (isLocalApi && isHostedPage) {
      return {
        title: 'The sign-in service is configured for a local computer',
        message: `This store is hosted at ${window.location.host}, but its API address is ${apiUrl.origin}. Set NEXT_PUBLIC_API_URL to the deployed API’s public URL ending in /api in your client hosting settings, then redeploy.`,
        retryable: false,
      };
    }

    if (isLocalApi) {
      return {
        title: 'The local sign-in server did not respond',
        message: `Stringtopia could not reach ${apiUrl.origin}. Check that the server is running from the server folder with npm run dev, then try again.`,
        retryable: true,
      };
    }

    return {
      title: 'Could not reach Stringtopia’s sign-in service',
      message: `The browser received no response from ${apiUrl?.host || 'the configured API'}. Check your connection. If it still fails, the service may be offline or its address/CORS settings may need attention.`,
      retryable: true,
    };
  }

  if ((error?.code === 'EMAIL_ALREADY_REGISTERED' || error?.status === 409) && mode === 'register') {
    return {
      title: 'This email already has an account',
      message: 'Log in with this email, or use a different email address to create an account.',
      action: 'login',
      retryable: false,
    };
  }

  if ((error?.code === 'ACCOUNT_NOT_FOUND' || error?.status === 404) && mode === 'login') {
    return {
      title: 'We couldn’t find an account for that email',
      message: 'Check the spelling, or create a Stringtopia account with this email address.',
      action: 'register',
      retryable: false,
    };
  }

  if (error?.code === 'GOOGLE_SIGN_IN_REQUIRED') {
    return {
      title: 'This account was created with Google',
      message: 'Choose Continue with Google to log in to this account.',
      retryable: false,
    };
  }

  if ((error?.code === 'INCORRECT_PASSWORD' || error?.status === 401) && mode === 'login') {
    return {
      title: 'That password doesn’t match',
      message: 'Double-check your password and try again.',
      retryable: false,
    };
  }

  if (error?.status === 400 && /email address/i.test(error.message || '')) {
    return {
      title: 'Check your email address',
      message: error.message,
      retryable: false,
    };
  }

  if (error?.status === 429) {
    return {
      title: 'Too many attempts',
      message: error.message || 'Please wait a few minutes, then try again.',
      retryable: false,
    };
  }

  if (error?.status === 503) {
    return {
      title: 'Sign-in is temporarily unavailable',
      message: error.message || 'Please try again in a little while.',
      retryable: true,
    };
  }

  if (error?.status >= 500) {
    const reference = error.requestId ? ` Share this reference with Stringtopia support: ${error.requestId}.` : '';
    return {
      title: 'Stringtopia is having a temporary problem',
      message: `Please try again in a moment. If this keeps happening, contact Stringtopia support.${reference}`,
      retryable: true,
    };
  }

  return {
    title: 'We could not complete your request',
    message: error?.message || 'Please check your details and try again.',
    retryable: false,
  };
}
