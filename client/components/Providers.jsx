'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);
export const cartLineKey = (item) => JSON.stringify([String(item.productId), item.variant || '']);
const GUEST = { token: null, user: null };
// Compatibility flag for existing components; the bearer credential stays in an HttpOnly cookie.
const COOKIE_SESSION = 'http-only-session';

// Cart state is persisted locally; auth credentials stay in the server-set HttpOnly cookie.
export default function Providers({ children, cspNonce = '' }) {
  const [auth, setAuth] = useState(GUEST);
  const [cart, setCart] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState('');
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState({ deliveryFee: 0, pickupAddress: '', instaPayAddress: '', instaPayAccountName: '', instaPayWhatsapp: '', backgroundAudioUrl: '' });
  const authRef = useRef(auth);
  const syncedCartProductsRef = useRef(new Set());
  authRef.current = auth;

  useEffect(() => {
    let active = true;
    try { setCart(JSON.parse(localStorage.getItem('st_cart')) || []); } catch { setCart([]); }
    let legacySession = null;
    try { legacySession = JSON.parse(localStorage.getItem('st_auth') || 'null'); } catch {}
    localStorage.removeItem('st_auth');

    const restoreSession = async () => {
      try {
        let response;
        if (legacySession?.token) {
          response = await fetch('/api/session', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ action: 'exchange', token: legacySession.token }),
          });
          if (!response.ok) response = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' });
        } else {
          response = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' });
        }
        const data = await response.json().catch(() => ({}));
        if (active) setAuth(data.user ? { token: COOKIE_SESSION, user: data.user } : GUEST);
      } catch {
        if (active) setAuth(GUEST);
      } finally {
        if (active) setReady(true);
      }
    };
    void restoreSession();
    api('/config').then(setConfig).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => { if (ready) localStorage.setItem('st_cart', JSON.stringify(cart)); }, [cart, ready]);
  useEffect(() => {
    const handleExpiredSession = (event) => {
      if (!event.detail?.token || authRef.current.token !== event.detail.token) return;
      authRef.current = GUEST;
      setAuth(GUEST);
      void fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
      setFavorites([]);
      setFavoritesLoading(false);
      setFavoritesError('');
    };
    window.addEventListener('stringtopia:auth-expired', handleExpiredSession);
    return () => window.removeEventListener('stringtopia:auth-expired', handleExpiredSession);
  }, []);
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

  useEffect(() => {
    if (!ready) return undefined;
    const productsToSync = [...new Map(cart.filter((item) => item.slug && !syncedCartProductsRef.current.has(String(item.productId)))
      .map((item) => [String(item.productId), item])).values()];
    if (!productsToSync.length) return undefined;
    productsToSync.forEach((item) => syncedCartProductsRef.current.add(String(item.productId)));
    let active = true;
    Promise.all(productsToSync.map(async (item) => {
      try {
        const product = await api(`/products/${encodeURIComponent(item.slug)}`);
        return {
          productId: String(item.productId), price: product.price, salePrice: product.salePrice ?? null,
          stock: product.stock, variants: product.variants || [], variantLabel: product.variantLabel || '',
        };
      } catch {
        return null;
      }
    })).then((results) => {
      if (!active) return;
      const latestPrices = new Map(results.filter(Boolean).map((item) => [item.productId, item]));
      if (!latestPrices.size) return;
      setCart((items) => items.map((item) => {
        const latest = latestPrices.get(String(item.productId));
        return latest ? {
          ...item, price: latest.price, salePrice: latest.salePrice, stock: latest.stock,
          variants: latest.variants, variantLabel: latest.variantLabel,
          ...(item.variant && !latest.variants.includes(item.variant) ? { variant: '' } : {}),
        } : item;
      }));
    });
    return () => { active = false; };
  }, [cart, ready]);

  const refreshConfig = async () => {
    const nextConfig = await api('/config');
    setConfig(nextConfig);
    return nextConfig;
  };

  const addToCart = (p, qty, selectedVariant = '') => {
    const stock = Number(p.stock);
    const limit = Number.isFinite(stock) ? Math.min(20, Math.max(0, stock)) : 20;
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const variant = String(selectedVariant || '').trim();
    if (!limit || (variants.length && !variants.includes(variant)) || (!variants.length && variant)) return false;
    const amount = Math.max(1, Math.min(20, Math.floor(Number(qty) || 1)));
    const key = cartLineKey({ productId: p._id, variant });
    const currentTotal = cart.filter((item) => String(item.productId) === String(p._id)).reduce((sum, item) => sum + item.qty, 0);
    if (currentTotal >= limit) return false;
    setCart((c) => {
      const found = c.find((i) => cartLineKey(i) === key);
      const productTotal = c.filter((item) => String(item.productId) === String(p._id)).reduce((sum, item) => sum + item.qty, 0);
      if (productTotal >= limit) return c;
      const nextQty = Math.min(limit - productTotal + (found?.qty || 0), (found?.qty || 0) + amount);
      if (found) {
        return c.map((i) => (cartLineKey(i) === key ? {
          ...i, name: p.name, image: i.image || p.images?.[0] || '', price: p.price,
          salePrice: p.salePrice ?? null, stock: limit, variants, variantLabel: p.variantLabel || '', qty: nextQty,
        } : i));
      }
      return [...c, {
        productId: p._id, slug: p.slug, name: p.name, price: p.price, salePrice: p.salePrice ?? null,
        image: p.images?.[0] || '', stock: limit, variants, variantLabel: p.variantLabel || '',
        ...(variant ? { variant } : {}), qty: Math.min(limit - productTotal, amount),
      }];
    });
    return true;
  };
  const setQty = (key, qty) => setCart((c) => {
    const item = c.find((entry) => cartLineKey(entry) === key);
    if (!item) return c;
    const otherQty = c.filter((entry) => String(entry.productId) === String(item.productId) && cartLineKey(entry) !== key)
      .reduce((sum, entry) => sum + entry.qty, 0);
    const limit = Number.isFinite(Number(item.stock)) ? Math.min(20, Number(item.stock)) : 20;
    const maxForLine = Math.max(item.qty, limit - otherQty);
    if (maxForLine < 1) return c;
    const nextQty = Math.max(1, Math.min(maxForLine, Math.floor(Number(qty) || 1)));
    return c.map((entry) => cartLineKey(entry) === key ? { ...entry, qty: nextQty } : entry);
  });
  const setVariant = (key, variant) => setCart((c) => {
    const current = c.find((entry) => cartLineKey(entry) === key);
    if (!current || current.variant === variant || !(current.variants || []).includes(variant)) return c;
    const nextKey = cartLineKey({ ...current, variant });
    const existing = c.find((entry) => cartLineKey(entry) === nextKey);
    if (existing) {
      const stock = Number.isFinite(Number(current.stock)) ? Math.min(20, Number(current.stock)) : 20;
      const otherQty = c.filter((entry) => String(entry.productId) === String(current.productId)
        && cartLineKey(entry) !== key && cartLineKey(entry) !== nextKey)
        .reduce((sum, entry) => sum + entry.qty, 0);
      const availableForMergedLine = stock - otherQty;
      if (availableForMergedLine < 1) return c;
      const mergedQty = Math.min(availableForMergedLine, existing.qty + current.qty);
      return c.filter((entry) => cartLineKey(entry) !== key && cartLineKey(entry) !== nextKey)
        .concat({ ...existing, variant, qty: Math.max(1, mergedQty) });
    }
    return c.map((entry) => cartLineKey(entry) === key ? { ...entry, variant } : entry);
  });
  const removeItem = (key) => setCart((c) => c.filter((i) => cartLineKey(i) !== key));
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
    const nextSession = session?.user ? { token: COOKIE_SESSION, user: session.user } : GUEST;
    authRef.current = nextSession;
    setFavorites([]);
    setFavoritesLoading(Boolean(session?.user));
    setFavoritesError('');
    setAuth(nextSession);
    return nextSession;
  };
  const logout = () => {
    authRef.current = GUEST;
    setAuth(GUEST);
    void fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
    setFavorites([]);
    setFavoritesLoading(false);
    setFavoritesError('');
  };

  const value = {
    ...auth, ready, config, refreshConfig, cart, addToCart, setQty, setVariant, removeItem,
    favorites, favoritesLoading, favoritesError, isFavorite, toggleFavorite,
    login, logout, cspNonce, clearCart: () => setCart([]),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
