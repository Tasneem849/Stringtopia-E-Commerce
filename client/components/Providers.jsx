'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);
const GUEST = { token: null, user: null };

// Auth + cart state, persisted in localStorage.
export default function Providers({ children }) {
  const [auth, setAuth] = useState(GUEST);
  const [cart, setCart] = useState([]);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState({ deliveryFee: 0, pickupAddress: '' });

  useEffect(() => {
    try {
      setAuth(JSON.parse(localStorage.getItem('st_auth')) || GUEST);
      setCart(JSON.parse(localStorage.getItem('st_cart')) || []);
    } catch {}
    setReady(true);
    api('/config').then(setConfig).catch(() => {});
  }, []);
  useEffect(() => { if (ready) localStorage.setItem('st_auth', JSON.stringify(auth)); }, [auth, ready]);
  useEffect(() => { if (ready) localStorage.setItem('st_cart', JSON.stringify(cart)); }, [cart, ready]);

  const addToCart = (p, qty) => setCart((c) => {
    const found = c.find((i) => i.productId === p._id);
    if (found) return c.map((i) => (i === found ? { ...i, qty: i.qty + qty } : i));
    return [...c, { productId: p._id, slug: p.slug, name: p.name, price: p.price, qty }];
  });
  const setQty = (id, qty) => setCart((c) => c.map((i) => (i.productId === id ? { ...i, qty } : i)));
  const removeItem = (id) => setCart((c) => c.filter((i) => i.productId !== id));

  const value = {
    ...auth, ready, config, cart, addToCart, setQty, removeItem,
    login: setAuth, logout: () => setAuth(GUEST), clearCart: () => setCart([]),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
