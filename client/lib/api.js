export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
export const money = (cents) =>
  new Intl.NumberFormat('en-EG', { style: 'currency', currency: process.env.NEXT_PUBLIC_CURRENCY || 'EGP' }).format(cents / 100);

export async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
    cache: 'no-store',
  });
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || Object.values(data?.errors || {}).flat()[0] || 'Something went wrong');
  return data;
}

// Cloudinary photos are served resized and in the best format for each browser; other links are left alone.
export const img = (url, width = 800) =>
  url?.includes('res.cloudinary.com') && url.includes('/upload/') ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`) : url;
