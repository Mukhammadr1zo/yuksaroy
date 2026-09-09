import { JetBrains_Mono, Manrope, Unbounded } from 'next/font/google';
import { NotFoundBody } from '@/components/site/NotFoundBody';
import './globals.css';

// Til segmenti bo'lmagan yoki mavjud bo'lmagan URL uchun: root layout [locale] ichida bo'lgani sababli
// bu sahifa o'z shriftlari va uslubini o'zi ulaydi (Next 16 globalNotFound). Mazmun va til NotFoundBody da.
const display = Unbounded({ subsets: ['latin', 'cyrillic'], weight: ['700'], variable: '--font-unbounded', display: 'swap' });
const body = Manrope({ subsets: ['latin', 'cyrillic'], weight: ['400', '600'], variable: '--font-manrope', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], weight: ['400'], variable: '--font-jetbrains', display: 'swap' });

export default function GlobalNotFound() {
  return (
    <html lang="uz" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="bg-sand text-ink antialiased">
        <NotFoundBody />
      </body>
    </html>
  );
}
