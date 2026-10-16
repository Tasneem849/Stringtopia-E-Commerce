'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { describeAuthError } from '@/lib/authErrors';
import { useStore } from '@/components/Providers';
import PasswordField from '@/components/PasswordField';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function AdminLogin() {
  const { user, ready, login, cspNonce } = useStore();
  const router = useRouter();
  const [fields, setFields] = useState({ email: '', password: '', totpCode: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user?.role === 'admin') router.replace('/admin');
  }, [ready, user, router]);

  function change(field) {
    return (event) => {
      setFields((current) => ({ ...current, [field]: event.target.value }));
      setError(null);
    };
  }

  async function submit(event) {
    event.preventDefault();
    const email = fields.email.trim();
    if (!email) {
      setError({ title: 'Enter the admin email', message: 'Add the email address used for the Stringtopia administrator account.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError({ title: 'Check the admin email', message: 'Enter a valid email address and try again.' });
      return;
    }
    if (!fields.password) {
      setError({ title: 'Enter the admin password', message: 'Type your administrator password to continue.' });
      return;
    }
    if (new TextEncoder().encode(fields.password).length > 72) {
      setError({ title: 'That password is too long', message: 'Choose a shorter password, especially if it contains emoji or accented symbols.' });
      return;
    }
    if (!/^\d{6}$/.test(fields.totpCode)) {
      setError({ title: 'Enter your authenticator code', message: 'Type the current six-digit code from the shop administrator’s authenticator app.' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await api('/auth/admin/login', {
        method: 'POST',
        body: {
          email, password: fields.password,
          totpCode: fields.totpCode,
        },
        timeoutMs: 15000,
      });
      if (session.user?.role !== 'admin') throw new Error('This account does not have administrator access.');
      login(session);
      router.replace('/admin');
    } catch (loginError) {
      setError(describeAuthError(loginError, 'admin-login'));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p role="status">Checking administrator session…</p>;

  return (
    <form onSubmit={submit} noValidate className="card mx-auto max-w-sm space-y-3">
      <p className="empty-cart-kicker">Stringtopia admin</p>
      <h1 className="text-2xl font-bold">Administrator sign-in</h1>
      <p className="text-sm text-stone-600">Use your admin email and password with the current authenticator code to open the dashboard.</p>
      <label className="block space-y-1 text-sm font-medium">
        <span>Admin email</span>
        <input type="email" autoComplete="username" required className="field w-full" value={fields.email} onChange={change('email')} />
      </label>
      <PasswordField
        placeholder="Admin password"
        autoComplete="current-password"
        value={fields.password}
        onChange={change('password')}
        className="field w-full"
      />
      <label className="block space-y-1 text-sm font-medium">
        <span>Authenticator code</span>
        <input
          type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          placeholder="6-digit code" className="field w-full" value={fields.totpCode}
          onChange={change('totpCode')}
        />
      </label>
      {error && <div role="alert" className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <p className="font-bold">{error.title}</p>
        <p>{error.message}</p>
      </div>}
      <button type="submit" className="btn btn-primary w-full" disabled={busy || !/^\d{6}$/.test(fields.totpCode)}>
        {busy ? 'Verifying…' : 'Sign in'}
      </button>
      <GoogleSignInButton nonce={cspNonce} adminMode adminEmail={fields.email} adminTotpCode={fields.totpCode} adminPassword={fields.password} />
      <p className="text-center text-sm"><Link href="/login" className="underline underline-offset-2">Return to customer sign-in</Link></p>
    </form>
  );
}
