'use client';

import { useStore } from './Providers';

// These public brand images stay visible in the storefront; this blocks the browser's
// context-menu and drag-to-tab shortcuts for guests and customer accounts.
export default function BrandArtwork({ src, alt, className }) {
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';
  const preventImageAction = (event) => event.preventDefault();

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={isAdmin ? undefined : false}
      onContextMenu={isAdmin ? undefined : preventImageAction}
      onDragStart={isAdmin ? undefined : preventImageAction}
    />
  );
}