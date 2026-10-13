'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useStore } from '@/components/Providers';

export default function Login() {
  const { login } = useStore();
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    try {
      login(await api(`/auth/${mode}`, { method: 'POST', body: f }));
      router.push('/');
    } catch (e) {
      setErr(e.message);
    }
  }

  const input = 'field w-full';
  return (
    <form onSubmit={submit} className="card mx-auto max-w-sm space-y-3">
      <h1 className="text-2xl font-bold">{mode === 'login' ? 'Log in' : 'Create account'}</h1>
      <input type="email" placeholder="Email" value={f.email} onChange={set('email')} className={input} />
      <input type="password" placeholder="Password (8+ characters)" value={f.password} onChange={set('password')} className={input} />
      {err && <p className="text-red-700">{err}</p>}
      <button className="btn btn-primary w-full">{mode === 'login' ? 'Log in' : 'Sign up'}</button>
      <button type="button" className="text-sm underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
      </button>
    </form>
  );
}
