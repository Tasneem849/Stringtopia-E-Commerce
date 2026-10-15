'use client';

import { useState } from 'react';

export default function PasswordField({ className = 'field w-full', ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative block w-full">
      <input
        {...inputProps}
        type={visible ? 'text' : 'password'}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 inline-flex w-11 cursor-pointer items-center justify-center rounded-r-xl text-stone-600 transition-colors hover:text-berry focus-visible:text-berry"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {visible ? (
            <>
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 8.8 4.3 9.8 6-.4.8-1.3 2-2.7 3.1M6.2 6.2C4.1 7.5 2.7 9.4 2.2 11c1 1.7 4.6 6 9.8 6 1.2 0 2.3-.2 3.3-.6" />
            </>
          ) : (
            <>
              <path d="M2.2 12s3.6-6 9.8-6 9.8 6 9.8 6-3.6 6-9.8 6-9.8-6-9.8-6Z" />
              <circle cx="12" cy="12" r="2.5" />
            </>
          )}
        </svg>
      </button>
    </span>
  );
}
