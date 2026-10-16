'use client';
import { useCallback, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getPostLoginPath } from '@/lib/navigation';
import { useStore } from './Providers';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function describeGoogleError(error, adminMode) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      title: 'You appear to be offline',
      message: 'Google sign-in could not reach Stringtopia. Check your internet connection, then try again.',
      retryable: true,
    };
  }

  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return {
      title: 'The sign-in server took too long to respond',
      message: 'The request timed out before sign-in finished. The service may be starting up or temporarily busy. Please try again.',
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
      title: 'Could not reach Stringtopia’s sign-in server',
      message: 'The sign-in request did not reach Stringtopia. Check your internet connection and try again. If this continues, contact Stringtopia support.',
      retryable: true,
    };
  }

  if (error?.status === 429) {
    return {
      title: 'Too many sign-in attempts',
      message: error.message || 'Please wait a few minutes before trying Google sign-in again.',
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
      message: error.message || 'The shop owner must configure an authenticator secret in the API hosting settings before admin sign-in can continue.',
      retryable: false,
    };
  }

  if (error?.code === 'ADMIN_LOGIN_REQUIRED') {
    return {
      title: 'Use administrator sign-in',
      message: adminMode
        ? 'This account did not receive administrator access. Verify the Google account linked to the shop administrator.'
        : 'Administrator accounts sign in from /admin/login. Google sign-in on the customer page is for customer accounts.',
      retryable: false,
    };
  }

  if (error?.code === 'GOOGLE_LINK_REQUIRES_PASSWORD') {
    return {
      title: 'Enter your current password to link Google',
      message: error.message || 'This email already has a password account. Enter its current password before linking Google; your password will stay active.',
      retryable: false,
    };
  }

  if (error?.code === 'AUTH_SERVICE_UNAVAILABLE') {
    return { title: 'Could not reach Stringtopia’s sign-in service', message: error.message, retryable: true };
  }

  if (error?.status === 503) {
    return {
      title: 'Google sign-in is not available right now',
      message: error.message || 'The sign-in service is not configured or is temporarily unavailable. Please use email and password or try again later.',
      retryable: false,
    };
  }

  if (error?.status >= 500) {
    const reference = error.requestId ? ` Share this reference with Stringtopia support: ${error.requestId}.` : '';
    return {
      title: 'Stringtopia is having a temporary problem',
      message: `Please try Google sign-in again in a moment. If this keeps happening, contact Stringtopia support.${reference}`,
      retryable: true,
    };
  }

  return {
    title: 'Google sign-in could not be completed',
    message: error?.message || 'Please click the Google button and try again.',
    retryable: false,
  };
}

export default function GoogleSignInButton({
  nonce, adminMode = false, adminEmail = '', adminTotpCode = '', adminPassword = '', accountEmail = '', accountPassword = '',
}) {
  const { login } = useStore();
  const router = useRouter();
  const buttonRef = useRef(null);
  const credentialRef = useRef('');
  const adminEmailRef = useRef(adminEmail);
  const adminTotpCodeRef = useRef(adminTotpCode);
  const adminPasswordRef = useRef(adminPassword);
  const accountEmailRef = useRef(accountEmail);
  const accountPasswordRef = useRef(accountPassword);
  adminEmailRef.current = adminEmail;
  adminTotpCodeRef.current = adminTotpCode;
  adminPasswordRef.current = adminPassword;
  accountEmailRef.current = accountEmail;
  accountPasswordRef.current = accountPassword;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submitCredential = useCallback(async (credential) => {
    setBusy(true);
    setError(null);
    try {
      login(await api(adminMode ? '/auth/admin/google' : '/auth/google', {
        method: 'POST',
        body: adminMode
          ? {
            credential, email: adminEmailRef.current.trim(), totpCode: adminTotpCodeRef.current,
            password: adminPasswordRef.current,
          }
          : {
            credential,
            ...(accountEmailRef.current.trim() ? { email: accountEmailRef.current.trim() } : {}),
            ...(accountPasswordRef.current ? { password: accountPasswordRef.current } : {}),
          },
        timeoutMs: 15000,
      }));
      credentialRef.current = '';
      router.replace(adminMode ? '/admin' : getPostLoginPath());
    } catch (err) {
      setError(describeGoogleError(err, adminMode));
    } finally {
      setBusy(false);
    }
  }, [adminMode, login, router]);

  const handleCredential = useCallback((response) => {
    if (!response?.credential) {
      setError({
        title: 'Google did not return a sign-in credential',
        message: 'The Google sign-in was cancelled or did not finish. Click the Google button and try again.',
        retryable: false,
      });
      return;
    }

    credentialRef.current = response.credential;
    submitCredential(response.credential);
  }, [submitCredential]);

  const renderButton = useCallback(() => {
    const identity = window.google?.accounts?.id;
    if (!identity || !buttonRef.current) return;

    buttonRef.current.replaceChildren();
    identity.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
    identity.renderButton(buttonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'left',
      width: Math.max(120, Math.min(400, Math.floor(buttonRef.current.clientWidth || 320))),
    });
  }, [handleCredential]);

  if (!GOOGLE_CLIENT_ID) {
    return <p className="rounded-xl bg-sun/20 p-3 text-center text-sm text-stone-700">
      Google sign-in needs to be configured. You can still use {adminMode ? 'your admin' : 'your'} email and password.
    </p>;
  }

  if (adminMode && (!/^\d{6}$/.test(adminTotpCode) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim()) || !adminPassword)) {
    return <p className="rounded-xl bg-sun/20 p-3 text-center text-sm text-stone-700">Enter the admin email, password, and six-digit authenticator code above to continue with Google.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
        <span className="h-px flex-1 bg-stone-300" />
        {adminMode ? 'or continue securely with Google' : 'or continue with'}
        <span className="h-px flex-1 bg-stone-300" />
      </div>
      <Script
        src="https://accounts.google.com/gsi/client"
        nonce={nonce || undefined}
        strategy="afterInteractive"
        onReady={renderButton}
        onError={() => setError({
          title: 'Google sign-in could not load',
          message: 'The browser could not download Google’s sign-in service. Check your connection or browser content blockers, then refresh this page or use email and password.',
          retryable: false,
        })}
      />
      <div ref={buttonRef} className="flex min-h-10 w-full justify-center" />
      {busy && <p role="status" className="text-center text-sm text-stone-600">Signing in with Google…</p>}
      {error && (
        <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-bold">{error.title}</p>
          <p>{error.message}</p>
          {error.retryable && credentialRef.current && (
            <button
              type="button"
              className="cursor-pointer font-bold underline underline-offset-2 disabled:opacity-60"
              onClick={() => submitCredential(credentialRef.current)}
              disabled={busy}
            >
              Try the sign-in request again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
