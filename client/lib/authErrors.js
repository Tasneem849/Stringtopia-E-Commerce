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
    const localHosts = ['localhost', '127.0.0.1', '::1'];
    const localSite = typeof window !== 'undefined' && localHosts.includes(window.location.hostname);
    if (localSite) {
      return {
        title: 'Could not connect to Stringtopia locally',
        message: 'Stringtopia could not reach its local sign-in route. Make sure both the client and API are running, refresh the page, and try again.',
        retryable: true,
      };
    }

    return {
      title: 'Could not reach Stringtopia’s sign-in service',
      message: 'The sign-in request did not reach Stringtopia. Check your internet connection and try again. If this continues, contact Stringtopia support.',
      retryable: true,
    };
  }

  if (error?.code === 'GOOGLE_SIGN_IN_REQUIRED') {
    return {
      title: 'This account was created with Google',
      message: 'Choose Continue with Google to log in to this account.',
      retryable: false,
    };
  }

  if (error?.code === 'ADMIN_MFA_REQUIRED' || error?.code === 'ADMIN_MFA_INVALID') {
    return {
      title: error.code === 'ADMIN_MFA_INVALID' ? 'Check your authenticator code' : 'Administrator verification required',
      message: error.message || 'Enter the current six-digit code from the shop administrator’s authenticator app.',
      retryable: false,
    };
  }

  if (error?.code === 'ADMIN_MFA_NOT_CONFIGURED') {
    return {
      title: 'Administrator sign-in is locked for setup',
      message: error.message || 'The shop owner must add the authenticator secret in the API hosting settings before admin sign-in can continue.',
      retryable: false,
    };
  }

  if (error?.code === 'ADMIN_LOGIN_REQUIRED') {
    return {
      title: 'Use administrator sign-in',
      message: error.message || 'Administrator accounts sign in from /admin/login.',
      retryable: false,
    };
  }

  if (error?.code === 'ADMIN_CREDENTIALS_INVALID') {
    return {
      title: 'Those administrator details don’t match',
      message: error.message || 'Check the admin email and password, then try again.',
      retryable: false,
    };
  }

  if (error?.code === 'AUTH_SERVICE_UNAVAILABLE') {
    return { title: 'Could not reach Stringtopia’s sign-in service', message: error.message, retryable: true };
  }

  if ((error?.code === 'INVALID_CREDENTIALS' || error?.status === 401) && mode === 'login') {
    return {
      title: 'Sign-in details don’t match',
      message: 'Check your email and password, then try again. If you normally use Google, choose Continue with Google.',
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
