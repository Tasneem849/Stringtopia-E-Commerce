'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { describeAuthError } from '@/lib/authErrors';
import { getPostLoginPath } from '@/lib/navigation';
import { useStore } from '@/components/Providers';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function Login() {
  const { login } = useStore();
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submitCredentials(submitMode = mode) {
    setBusy(true);
    setErr(null);
    try {
      login(await api(`/auth/${submitMode}`, { method: 'POST', body: f, timeoutMs: 15000 }));
      router.replace(getPostLoginPath());
    } catch (error) {
      setErr(describeAuthError(error, submitMode));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    await submitCredentials();
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setErr(null);
  }

  const input = 'field w-full';
  return (
    <form onSubmit={submit} className="card mx-auto max-w-sm space-y-3">
      <h1 className="text-2xl font-bold">{mode === 'login' ? 'Log in' : 'Create account'}</h1>
      <input type="email" placeholder="Email" value={f.email} onChange={set('email')} className={input} />
      <input type="password" placeholder="Password (8+ characters)" value={f.password} onChange={set('password')} className={input} />
      {err && <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <p className="font-bold">{err.title}</p>
        <p>{err.message}</p>
        {err.action && <button type="button" className="cursor-pointer font-bold underline underline-offset-2" onClick={() => changeMode(err.action)}>
          {err.action === 'login' ? 'Go to log in' : 'Create an account'}
        </button>}
        {err.retryable && <button type="button" className="ml-3 cursor-pointer font-bold underline underline-offset-2 disabled:opacity-60" onClick={() => submitCredentials()} disabled={busy}>
          Try again
        </button>}
      </div>}
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
      </button>
      <GoogleSignInButton />
      <button type="button" className="cursor-pointer text-sm underline hover:text-blue-700" onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
      </button>
      <p className="text-center text-xs leading-relaxed text-stone-600">
        Creating an account or using Google sign-in is covered by our <Link href="/terms" className="underline underline-offset-2">Terms of sale</Link> and <Link href="/privacy" className="underline underline-offset-2">Privacy policy</Link>.
      </p>
    </form>
  );
}
