'use client';
import { useEffect, useState } from 'react';
import { money } from '@/lib/api';
import { useStore } from './Providers';

const EMPTY = {
  recipientName: '', phone: '', giftMessage: '',
  address: { line1: '', line2: '', city: '', postalCode: '', country: '' },
};
const input = 'field w-full';

// Delivery to me / delivery to someone else as a gift / free pickup.
// Reports the matching `delivery` object to the parent on every change.
export default function DeliveryForm({ onChange }) {
  const { config } = useStore();
  const [opt, setOpt] = useState('me');
  const [f, setF] = useState(EMPTY);

  const emit = (o, v) => onChange(o === 'pickup' ? { method: 'pickup' } : { method: 'delivery', gift: o === 'gift', ...v });
  useEffect(() => { emit('me', EMPTY); }, []);
  const pick = (o) => { setOpt(o); emit(o, f); };
  const set = (patch) => { const v = { ...f, ...patch }; setF(v); emit(opt, v); };
  const addr = (k) => ({ value: f.address[k], onChange: (e) => set({ address: { ...f.address, [k]: e.target.value } }) });

  const fee = config.deliveryFee ? `+${money(config.deliveryFee)}` : 'Free';
  const gift = opt === 'gift';
  return (
    <fieldset className="space-y-2 card text-sm">
      <legend className="font-semibold">Delivery</legend>
      {[['me', 'Deliver to me', fee], ['gift', 'Send to someone else as a gift', fee], ['pickup', 'Pick up from us', 'Free']].map(([k, label, price]) => (
        <label key={k} className="opt">
          <input type="radio" name="delivery" checked={opt === k} onChange={() => pick(k)} />
          {label}
          <span className="ml-auto text-stone-500">{price}</span>
        </label>
      ))}
      {opt === 'pickup' ? (
        <p className="text-stone-600">Pick up at: {config.pickupAddress || 'our address (shown after you order)'}</p>
      ) : (
        <div className="space-y-2">
          <input required placeholder={gift ? "Recipient's name" : 'Your name'} value={f.recipientName} onChange={(e) => set({ recipientName: e.target.value })} className={input} />
          <input required type="tel" placeholder={gift ? "Recipient's phone" : 'Phone'} value={f.phone} onChange={(e) => set({ phone: e.target.value })} className={input} />
          <input required placeholder="Address" {...addr('line1')} className={input} />
          <input placeholder="Apartment, floor... (optional)" {...addr('line2')} className={input} />
          <div className="flex gap-2">
            <input required placeholder="City" {...addr('city')} className={input} />
            <input placeholder="Postal code" {...addr('postalCode')} className={input} />
          </div>
          <input required placeholder="Country" {...addr('country')} className={input} />
          {gift && (
            <textarea
              placeholder="Gift message (optional, we'll add a card)" maxLength={300}
              value={f.giftMessage} onChange={(e) => set({ giftMessage: e.target.value })} className={input}
            />
          )}
        </div>
      )}
    </fieldset>
  );
}
