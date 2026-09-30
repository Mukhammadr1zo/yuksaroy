import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { CompareTray } from '@/components/compare/CompareTray';
import { RegisterNudge } from '@/components/site/RegisterNudge';
import { HelpWidget } from '@/components/help/HelpWidget';
import { SiteAds } from '@/components/site/AdSlot';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" className="min-h-[70vh]">{children}</main>
      {/* Futer shu yerda: shartlar va maxfiylik havolalari faqat bosh sahifada emas,
          har bir ochiq sahifada ko'rinsin. Ilgari futer faqat bosh sahifa va kirish
          sahifasida edi. Ataylab: holat sahifalariga ham tushadi. */}
      <Footer />
      {/* Solishtirish savati: tanlov bo'lsa pastda suzadi, bo'lmasa hech narsa */}
      <CompareTray />
      {/* Mehmonga 3 daqiqadan keyin bir marta: hisob nima berishini aytadi */}
      <RegisterNudge />
      {/* Yordam chati: o'ng pastdagi tugma, ko'p so'raladigan savollar */}
      <HelpWidget />
      {/* Reklamaning uch joyi (ikki yon ustun va pastki banner) bitta so'rovdan chiziladi.
          Layoutda, har sahifada alohida emas: yangi sahifa qo'shilganda esdan chiqmaydi. */}
      <SiteAds />
    </>
  );
}
