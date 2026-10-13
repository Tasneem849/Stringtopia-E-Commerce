'use client';
import { useState } from 'react';
import { useStore } from './Providers';

export default function FavoriteButton({ product, overlay = false }) {
  const { user, ready, favoritesLoading, isFavorite, toggleFavorite } = useStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const active = isFavorite(product._id);

  if (!ready || !user || favoritesLoading) return null;

  async function handleClick() {
    setSaving(true);
    setError('');
    try {
      await toggleFavorite(product);
    } catch (err) {
      setError(err.message || 'Could not update favorites. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`favorite-button${overlay ? ' favorite-button-overlay' : ''}${active ? ' favorite-button-active' : ''}`}
        onClick={handleClick}
        disabled={saving}
        aria-label={`${active ? 'Remove' : 'Add'} ${product.name} ${active ? 'from' : 'to'} favorites`}
        aria-pressed={active}
        title={active ? 'Remove from favorites' : 'Add to favorites'}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill={active ? 'currentColor' : 'none'}>
          <path d="M20.8 8.8c0 5.1-8.8 10.2-8.8 10.2S3.2 13.9 3.2 8.8A4.3 4.3 0 0 1 12 6.9a4.3 4.3 0 0 1 8.8 1.9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </button>
      {error && <span role="status" className="sr-only">{error}</span>}
    </>
  );
}
