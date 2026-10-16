'use client';

import { useEffect, useState } from 'react';

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 320);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  if (!visible) return null;

  function scrollToTop() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      window.scrollTo(0, 0);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      className="cursor-pointer fixed bottom-4 right-4 z-50 grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-berry text-white shadow-lg transition duration-200 hover:-translate-y-1 hover:bg-sun hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-grape"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 14 6-6 6 6" />
        <path d="M12 8v12" />
      </svg>
    </button>
  );
}
