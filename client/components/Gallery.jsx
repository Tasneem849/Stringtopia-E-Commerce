'use client';
import { useState } from 'react';
import { img } from '@/lib/api';
import Thumb from './Thumb';

// Main photo plus small ones to switch between.
export default function Gallery({ images = [] }) {
  const [i, setI] = useState(0);
  return (
    <div className="space-y-2">
      <Thumb src={images[i]} />
      {images.length > 1 && (
        <div className="flex gap-2">
          {images.map((u, n) => (
            <button
              key={u} onClick={() => setI(n)} aria-label={`Show photo ${n + 1}`}
              className={`h-16 w-16 cursor-pointer overflow-hidden rounded-xl border-2 transition ${n === i ? 'border-ink' : 'border-transparent opacity-70 hover:border-grape hover:opacity-100'}`}
            >
              <img src={img(u, 160)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
