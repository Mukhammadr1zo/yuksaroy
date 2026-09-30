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
    // lang="uz" qattiq yozilgan va shunday qoladi: bu sahifa /_not-found marshruti bo'lib,
    // qurish paytida bir marta HTML ga aylanadi va topilmagan har qanday manzilga o'sha bitta
    // fayl beriladi. Next hujjatiga ko'ra bu faylga prop berilmaydi, so'rov manzili esa hech
    // qaysi sarlavhada kelmaydi (headers() faqat host ni beradi), ya'ni server tomonda tilni
    // aniqlashning yo'li yo'q. Tuzatish mijoz tomonida: NotFoundBody document.documentElement.lang
    // ni /ru yoki /en prefiksiga qarab almashtiradi. Server tomonda tuzatmoqchi bo'lsa, manzilni
    // proxy.ts so'rov sarlavhasiga qo'yishi kerak.
    <html lang="uz" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="bg-sand text-ink antialiased">
        <NotFoundBody />
      </body>
    </html>
  );
}
