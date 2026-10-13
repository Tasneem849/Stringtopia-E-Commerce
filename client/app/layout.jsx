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
            <a href="https://www.facebook.com/StringTopia/" target="_blank" rel="noopener noreferrer" className="nav-link mt-2 inline-block">
              Follow us on Facebook
            </a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
