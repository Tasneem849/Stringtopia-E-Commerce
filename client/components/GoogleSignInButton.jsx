'use client';
import { useCallback, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { API, api } from '@/lib/api';
import { getPostLoginPath } from '@/lib/navigation';
import { useStore } from './Providers';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function describeGoogleError(error) {
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
    let apiUrl;
    try { apiUrl = new URL(API); } catch {}

    const isLocalApi = apiUrl && ['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname);
    const isHostedPage = typeof window !== 'undefined'
      && !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

    if (isLocalApi && isHostedPage) {
      return {
        title: 'The sign-in API is configured for a local computer',
        message: `This store is hosted at ${window.location.host}, but its API address is ${apiUrl.origin}. On a hosted site, localhost points to each visitor’s own device. Set NEXT_PUBLIC_API_URL to your deployed API’s public URL (ending in /api) in the client hosting settings, then redeploy.`,
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
      title: 'Could not reach Stringtopia’s sign-in server',
      message: `The browser received no response from ${apiUrl?.host || 'the configured API'}. Check your connection. If it still fails, the API may be offline, its address may be incorrect, or its CORS settings may not allow this store.`,
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

  if (error?.status === 503) {
    return {
      title: 'Google sign-in is not available right now',
      message: error.message || 'The sign-in service is not configured or is temporarily unavailable. Please use email and password or try again later.',
      retryable: false,
    };
  }

  if (error?.status >= 500) {
    return {
      title: 'Stringtopia is having a temporary problem',
      message: 'Please try Google sign-in again in a moment. If this keeps happening, contact Stringtopia support.',
      retryable: true,
    };
  }

  return {
    title: 'Google sign-in could not be completed',
    message: error?.message || 'Please click the Google button and try again.',
    retryable: false,
  };
}

export default function GoogleSignInButton() {
  const { login } = useStore();
  const router = useRouter();
  const buttonRef = useRef(null);
  const credentialRef = useRef('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submitCredential = useCallback(async (credential) => {
    setBusy(true);
    setError(null);
    try {
      login(await api('/auth/google', {
        method: 'POST',
        body: { credential },
        timeoutMs: 15000,
      }));
      credentialRef.current = '';
      router.replace(getPostLoginPath());
    } catch (err) {
      setError(describeGoogleError(err));
    } finally {
      setBusy(false);
    }
  }, [login, router]);

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
      Google sign-in needs to be configured. You can still use your email and password.
    </p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
        <span className="h-px flex-1 bg-stone-300" />
        or continue with
        <span className="h-px flex-1 bg-stone-300" />
      </div>
      <Script
        src="https://accounts.google.com/gsi/client"
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
