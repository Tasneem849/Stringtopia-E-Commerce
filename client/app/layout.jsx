import './globals.css';
import { Gaegu, Figtree } from 'next/font/google';
import Providers from '@/components/Providers';
import Header from '@/components/Header';

// Hand-drawn display face to echo the pen lettering in the logo, clean sans for reading
const display = Gaegu({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-display' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body' });

export const metadata = {
  title: 'Stringtopia | Handmade crochet',
  description: 'Handmade crochet pieces, made with love.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen">
        <Providers>
          <Header />
          <main className="mx-auto max-w-5xl p-4 md:p-6">{children}</main>
          <footer className="mt-12 border-t-2 border-dashed border-ink/20 p-6 text-center text-sm">
            <p>Handmade with love by Stringtopia.</p>
            <nav aria-label="Stringtopia social media" className="mt-4 flex justify-center gap-3">
              <a
                href="https://www.facebook.com/StringTopia/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Stringtopia on Facebook"
                title="Facebook"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/20 text-[#1877F2] transition-colors hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M13.5 21v-7.6h2.55l.38-2.96H13.5V8.55c0-.86.24-1.45 1.47-1.45h1.57V4.46c-.27-.04-1.2-.12-2.28-.12-2.26 0-3.8 1.38-3.8 3.92v2.18H7.9v2.96h2.56V21h3.04Z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/string_topia"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Stringtopia on Instagram"
                title="Instagram"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/20 text-[#C13584] transition-colors hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href="https://whatsapp.com/channel/0029VbDBU0m3LdQTzwn5I53i"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Stringtopia on WhatsApp"
                title="WhatsApp"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/20 text-[#25D366] transition-colors hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.4 11.9a8.4 8.4 0 0 1-12.4 7.4L4 20l.8-3.9a8.4 8.4 0 1 1 15.6-4.2Z" />
                  <path d="M9 8.5c.2-.4.4-.4.7-.4h.4c.2 0 .3.1.4.4l.6 1.4c.1.2.1.4 0 .5l-.5.6c-.1.2-.2.3 0 .5.4.7 1 1.3 1.8 1.7.2.1.4.1.5-.1l.6-.7c.1-.2.3-.2.5-.1l1.4.7c.2.1.3.2.3.4 0 .3-.2.9-.6 1.2-.4.4-1 .6-1.7.5-1-.1-2.2-.7-3.4-1.8-1.1-1-1.8-2.3-2-3.2-.2-.8 0-1.3.3-1.6Z" />
                </svg>
              </a>
            </nav>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
