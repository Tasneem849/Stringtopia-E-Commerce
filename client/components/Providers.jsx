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
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState('');
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState({ deliveryFee: 0, pickupAddress: '', instaPayAddress: '', instaPayAccountName: '', instaPayWhatsapp: '', backgroundAudioUrl: '' });

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
  useEffect(() => {
    if (!ready) return undefined;
    const missingImages = cart.filter((item) => !item.image && item.slug);
    if (!missingImages.length) return undefined;

    let active = true;
    Promise.all(missingImages.map(async (item) => {
      try {
        const product = await api(`/products/${encodeURIComponent(item.slug)}`);
        return { productId: String(item.productId), image: product.images?.[0] || '' };
      } catch {
        return null;
      }
    })).then((results) => {
      if (!active) return;
      const images = new Map(results.filter((result) => result?.image).map(({ productId, image }) => [productId, image]));
      if (!images.size) return;
      setCart((items) => items.map((item) => {
        const image = images.get(String(item.productId));
        return !item.image && image ? { ...item, image } : item;
      }));
    });

    return () => { active = false; };
  }, [cart, ready]);
  useEffect(() => {
    if (!ready) return undefined;
    let active = true;
    if (!auth.token) {
      setFavorites([]);
      setFavoritesLoading(false);
      setFavoritesError('');
      return () => { active = false; };
    }

    setFavorites([]);
    setFavoritesLoading(true);
    setFavoritesError('');
    api('/favorites', { token: auth.token })
      .then((items) => { if (active) setFavorites(items); })
      .catch((error) => {
        if (active) {
          setFavorites([]);
          setFavoritesError(error.message);
        }
      })
      .finally(() => { if (active) setFavoritesLoading(false); });
    return () => { active = false; };
  }, [auth.token, ready]);

  const refreshConfig = async () => {
    const nextConfig = await api('/config');
    setConfig(nextConfig);
    return nextConfig;
  };

  const addToCart = (p, qty) => {
    const stock = Number(p.stock);
    const limit = Number.isFinite(stock) ? Math.min(20, Math.max(0, stock)) : 20;
    if (!limit) return;
    const amount = Math.max(1, Math.min(20, Math.floor(Number(qty) || 1)));
    setCart((c) => {
      const found = c.find((i) => String(i.productId) === String(p._id));
      if (found) {
        if (found.qty >= limit) return c;
        const nextQty = Math.min(limit, found.qty + amount);
        return c.map((i) => (i === found ? { ...i, image: i.image || p.images?.[0] || '', qty: nextQty } : i));
      }
      return [...c, { productId: p._id, slug: p.slug, name: p.name, price: p.price, image: p.images?.[0] || '', qty: Math.min(limit, amount) }];
    });
  };
  const setQty = (id, qty) => setCart((c) => c.map((i) => (i.productId === id ? { ...i, qty } : i)));
  const removeItem = (id) => setCart((c) => c.filter((i) => i.productId !== id));
  const isFavorite = (id) => favorites.some((item) => String(item._id) === String(id));
  const toggleFavorite = async (product) => {
    if (!auth.token) throw new Error('Log in to save favorites.');
    const productId = String(product._id);
    if (isFavorite(productId)) {
      await api(`/favorites/${productId}`, { token: auth.token, method: 'DELETE' });
      setFavorites((items) => items.filter((item) => String(item._id) !== productId));
    } else {
      await api(`/favorites/${productId}`, { token: auth.token, method: 'POST' });
      setFavorites((items) => items.some((item) => String(item._id) === productId) ? items : [...items, product]);
    }
    setFavoritesError('');
  };
  const login = (session) => {
    setFavorites([]);
    setFavoritesLoading(Boolean(session?.token));
    setFavoritesError('');
    setAuth(session);
  };
  const logout = () => {
    setAuth(GUEST);
    setFavorites([]);
    setFavoritesLoading(false);
    setFavoritesError('');
  };

  const value = {
    ...auth, ready, config, refreshConfig, cart, addToCart, setQty, removeItem,
    favorites, favoritesLoading, favoritesError, isFavorite, toggleFavorite,
    login, logout, clearCart: () => setCart([]),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
