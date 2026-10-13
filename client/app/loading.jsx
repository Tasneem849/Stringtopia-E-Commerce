import styles from './loading.module.css';

export default function Loading() {
  return (
    <div className={styles.screen} role="status" aria-live="polite" aria-atomic="true">
      <div className={styles.card}>
        <p className={styles.eyebrow}>Handmade with love</p>
        <h1 className={styles.brand}>Stringtopia</h1>

        <svg
          className={styles.scene}
          viewBox="0 0 320 198"
          aria-hidden="true"
          focusable="false"
        >
          <ellipse cx="160" cy="172" rx="112" ry="8" fill="#e9d8c5" />

          <path
            className={styles.thread}
            d="M101 145c18 15 27 25 44 18s20-11 32-4 18 14 31 8 19-11 32-2"
            fill="none"
            stroke="#cb858a"
            strokeWidth="2.6"
            strokeLinecap="round"
          />

          <g className={styles.yarn}>
            <circle cx="79" cy="137" r="27" fill="#e8a1aa" stroke="#8c4f54" strokeWidth="2" />
            <path
              d="M58 123c12 5 24 5 41-1M54 135c13 7 29 7 49-1M58 149c12-4 27-4 41 2"
              fill="none"
              stroke="#fff4e8"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M70 111c-4 13-5 31 1 51M86 111c-5 14-5 29 1 51"
              fill="none"
              stroke="#c47c85"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>

          <g className={styles.flower}>
            <g fill="#f3b9c0" stroke="#b96c76" strokeWidth="1.8">
              <ellipse cx="160" cy="54" rx="15" ry="23" />
              <ellipse cx="184" cy="68" rx="15" ry="23" transform="rotate(60 184 68)" />
              <ellipse cx="184" cy="96" rx="15" ry="23" transform="rotate(120 184 96)" />
              <ellipse cx="160" cy="110" rx="15" ry="23" />
              <ellipse cx="136" cy="96" rx="15" ry="23" transform="rotate(60 136 96)" />
              <ellipse cx="136" cy="68" rx="15" ry="23" transform="rotate(120 136 68)" />
            </g>
            <g fill="none" stroke="#fff4e8" strokeWidth="1.7" strokeLinecap="round">
              <path d="M160 37v7m24 14-5 5m5 34-6-3m-18 30v-7m-24-14 6-4m-6-31 6 4" />
            </g>
            <circle cx="160" cy="82" r="24" fill="#f6d77c" stroke="#8c6245" strokeWidth="2" />
            <circle cx="152" cy="80" r="2.2" fill="#302a26" />
            <circle cx="168" cy="80" r="2.2" fill="#302a26" />
            <path d="M153 88q7 7 14 0" fill="none" stroke="#302a26" strokeWidth="2" strokeLinecap="round" />
            <path d="M143 68q4-4 8-4m18 0q4 0 8 4" fill="none" stroke="#fff4e8" strokeWidth="2" strokeLinecap="round" />
          </g>

          <g className={styles.hook}>
            <path
              d="M255 38v66c0 11 7 18 16 18 10 0 16-7 16-17v-8"
              fill="none"
              stroke="#b88b69"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M255 39v30" fill="none" stroke="#f4d9bd" strokeWidth="2" strokeLinecap="round" />
            <path d="M279 100q3 7 9 7" fill="none" stroke="#b88b69" strokeWidth="7" strokeLinecap="round" />
          </g>

          <path className={[styles.heart, styles.heartOne].join(' ')} d="M111 57c-7-6-15 4 0 15 15-11 7-21 0-15Z" fill="#dc7f8c" />
          <path className={[styles.heart, styles.heartTwo].join(' ')} d="M219 77c-6-5-13 4 0 13 13-9 6-18 0-13Z" fill="#a7b88e" />
          <path className={[styles.heart, styles.heartThree].join(' ')} d="M204 39c-5-4-10 3 0 10 10-7 5-14 0-10Z" fill="#e6a1a5" />
        </svg>

        <p className={styles.message}>Stitching something lovely for you...</p>
        <div className={styles.loadingIndicator} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}