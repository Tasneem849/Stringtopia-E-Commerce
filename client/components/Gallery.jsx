'use client';
import { useState } from 'react';
import { img } from '@/lib/api';
import Thumb from './Thumb';

// Main photo plus small ones to switch between.
export default function Gallery({ images = [] }) {
  const [i, setI] = useState(0);
  const currentIndex = images.length ? Math.min(i, images.length - 1) : 0;
  const movePhoto = (direction) => {
    setI((current) => (Math.min(current, images.length - 1) + direction + images.length) % images.length);
  };
  return (
    <div className="space-y-2">
      <div className="product-gallery-viewer">
        <Thumb src={images[currentIndex]} alt={images.length > 1 ? `Product photo ${currentIndex + 1} of ${images.length}` : 'Product photo'} />
        {images.length > 1 && <>
          <button type="button" className="product-gallery-arrow product-gallery-arrow-prev" aria-label="Previous product photo" onClick={() => movePhoto(-1)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m14.5 5-7 7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="product-gallery-arrow product-gallery-arrow-next" aria-label="Next product photo" onClick={() => movePhoto(1)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m9.5 5 7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span className="product-gallery-count" aria-live="polite" aria-atomic="true">{currentIndex + 1} / {images.length}</span>
        </>}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2">
          {images.map((u, n) => (
            <button
              key={`${u}-${n}`} onClick={() => setI(n)} aria-label={`Show photo ${n + 1}`} aria-pressed={n === currentIndex}
              className={`h-16 w-16 cursor-pointer overflow-hidden rounded-xl border-2 transition ${n === currentIndex ? 'border-ink' : 'border-transparent opacity-70 hover:border-grape hover:opacity-100'}`}
            >
              <img src={img(u, 160)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
