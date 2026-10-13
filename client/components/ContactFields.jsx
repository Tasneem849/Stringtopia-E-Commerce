'use client';
import { useEffect, useState } from 'react';
import { useStore } from './Providers';

// Who is paying. Paymob needs a name, mobile number and email; logged-in customers use their account email.
export default function ContactFields({ onChange, askEmail = true }) {
  const { user } = useStore();
  const [f, setF] = useState({ name: '', phone: '', email: '' });
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));

  useEffect(() => { if (user && !f.name) setF((c) => ({ ...c, name: user.name })); }, [user]);
  useEffect(() => { onChange({ name: f.name, phone: f.phone, email: user?.email || f.email }); }, [f, user]);

  return (
    <fieldset className="card space-y-2 text-sm">
      <legend className="font-semibold">Your details</legend>
      <input required autoComplete="name" placeholder="Full name" value={f.name} onChange={set('name')} className="field w-full" />
      <input required type="tel" autoComplete="tel" placeholder="Mobile number, e.g. 01012345678" value={f.phone} onChange={set('phone')} className="field w-full" />
      {askEmail && (user
        ? <p className="text-stone-600">Order updates go to {user.email}.</p>
        : <input required type="email" autoComplete="email" placeholder="Email for your order confirmation" value={f.email} onChange={set('email')} className="field w-full" />)}
    </fieldset>
  );
}
