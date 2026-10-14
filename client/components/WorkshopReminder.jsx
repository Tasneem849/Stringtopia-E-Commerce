'use client';

import { useEffect, useState } from 'react';

const dismissalKey = 'stringtopia-workshop-reminder-dismissed';

export default function WorkshopReminder() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(dismissalKey) === 'true') setVisible(false);
    } catch {
      // Keep the reminder usable if browser storage is unavailable.
    }
  }, []);

  function dismissReminder() {
    try {
      window.sessionStorage.setItem(dismissalKey, 'true');
    } catch {
      // Dismissal still works for this page even when browser storage is unavailable.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-3">
      <aside
        role="note"
        aria-label="Crochet workshop reminder"
        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-berry/40 bg-pink/25 px-3 py-2.5 text-center text-sm font-semibold text-ink md:gap-3 md:px-4 md:text-base"
      >
        <span aria-hidden="true">🧶</span>
        <span className="flex-1">Don’t forget to ask us about our crochet workshops and courses!</span>
        <span aria-hidden="true">✂️</span>
        <button
          type="button"
          onClick={dismissReminder}
          aria-label="Dismiss crochet workshop reminder"
          title="Dismiss reminder"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink/20 bg-white/70 text-lg leading-none transition hover:bg-sun focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m5 5 10 10M15 5 5 15" />
          </svg>
        </button>
      </aside>
    </div>
  );
}