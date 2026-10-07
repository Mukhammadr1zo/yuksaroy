import { NotFoundBody } from '@/components/site/NotFoundBody';
import { fontVars } from './fonts';
import './globals.css';

// Til segmenti bo'lmagan yoki mavjud bo'lmagan URL uchun: root layout [locale] ichida bo'lgani sababli
// bu sahifa shriftlar va uslubni o'zi ulaydi (Next 16 globalNotFound). Mazmun va til NotFoundBody da.
// Shriftlar o'z nusxasi emas, layout bilan bitta (app/fonts.ts): Next bu sahifa shriftlarini ham
// har sahifaga preload qilardi va alohida nusxa 4 ta keraksiz fayl (61 KB) bo'lib tushardi.

export default function GlobalNotFound() {
  return (
    // lang="uz" qattiq yozilgan va shunday qoladi: bu sahifa /_not-found marshruti bo'lib,
    // qurish paytida bir marta HTML ga aylanadi va topilmagan har qanday manzilga o'sha bitta
    // fayl beriladi. Next hujjatiga ko'ra bu faylga prop berilmaydi, so'rov manzili esa hech
    // qaysi sarlavhada kelmaydi (headers() faqat host ni beradi), ya'ni server tomonda tilni
    // aniqlashning yo'li yo'q. Tuzatish mijoz tomonida: NotFoundBody document.documentElement.lang
    // ni /ru yoki /en prefiksiga qarab almashtiradi. Server tomonda tuzatmoqchi bo'lsa, manzilni
    // proxy.ts so'rov sarlavhasiga qo'yishi kerak.
    <html lang="uz" className={fontVars}>
      <body className="bg-sand text-ink antialiased">
        <NotFoundBody />
      </body>
    </html>
  );
}
