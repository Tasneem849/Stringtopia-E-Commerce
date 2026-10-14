'use client';
import { useCallback, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getPostLoginPath } from '@/lib/navigation';
import { useStore } from './Providers';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function GoogleSignInButton() {
  const { login } = useStore();
  const router = useRouter();
  const buttonRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCredential = useCallback(async (response) => {
    if (!response?.credential) {
      setError('Google sign-in did not return a credential. Please try again.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      login(await api('/auth/google', { method: 'POST', body: { credential: response.credential } }));
      router.replace(getPostLoginPath());
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [login, router]);

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
        onError={() => setError('Google sign-in could not load. Check your connection or use email and password.')}
      />
      <div ref={buttonRef} className="flex min-h-10 w-full justify-center" />
      {busy && <p role="status" className="text-center text-sm text-stone-600">Signing in with Google…</p>}
      {error && <p role="alert" className="text-center text-sm text-red-700">{error}</p>}
    </div>
  );
}
