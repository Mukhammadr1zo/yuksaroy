import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Explainer } from '@/components/landing/Explainer';
import { Logo } from '@/components/site/Logo';

/*
 * Ko'rgazmani videoga olish uchun yalong'och sahifa.
 *
 * Nega alohida sahifa: ekranni yozib oluvchi vosita ELEMENTNI emas, butun oynani yozadi.
 * Ya'ni bosh sahifadan yozib olsak kadrga sarlavha, menyu va qo'shni bo'limlar tushadi.
 * Shuning uchun ko'rgazma yolg'iz turgan manzil kerak.
 *
 * Hech qayerdan havola qilinmaydi va sitemap ro'yxatiga qo'shilmaydi: manzil faqat qo'lda
 * ochiladi. Qidiruv tizimi tasodifan topib qolsa ham indekslamasin.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ExplainerShotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      {/*
        Sahifa (public) qobig'i ichida: tepada Header, pastda Footer, reklama joylari va
        yordam tugmasi chiziladi. Ular uchun alohida qobiq yasalmadi, chunki qobiq butun
        bir papkaga ta'sir qiladi, kerak bo'lgani esa bitta manzil. Butun oynani egallagan
        qatlam ularning ustiga tushadi (sayt chegarasi z-50 gacha, shuning uchun z-60).
        body ning aylantirgichi ham yashiriladi: aks holda videoning o'ng chetida
        aylantirish chizig'i turardi. Uslub joyida chiziladi: href va precedence berilsa React
        uni <head> ga ko'chirar va sahifa yo'qolganda ham qoldirar edi, ya'ni shu manzildan
        chiqqandan keyin butun sayt aylanmay qolardi.
      */}
      {/* Klaviatura eslatmasi videoda yashiriladi: kadrni ko'rayotgan odamda na sichqoncha,
          na klaviatura bor, ya'ni u faqat joy egallaydi. Sayt ichida esa u kerak va qoladi. */}
      <style>{'body{overflow:hidden}[data-explainer-hint]{display:none}'}</style>
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-sand">
        {/* min-h-full + flex: kadr baland bo'lsa markazda, sig'masa tepadan boshlanadi va
            to'liq aylantiriladi (place-items-center da tepasi qirqilib qolardi). */}
        <div className="flex min-h-full items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-6xl">
            {/* Brend belgisi faqat shu yerda, ko'rgazmaning o'zida emas: sayt ichida logotip
                allaqachon sarlavhada turadi va ikkinchisi ortiqcha bo'lardi. Videoda esa
                sarlavha yo'q, ya'ni belgi bo'lmasa kadr kimniki ekani bilinmaydi. */}
            <div className="mb-6 flex justify-center md:mb-8 md:justify-start"><Logo /></div>
            <Explainer />
          </div>
        </div>
      </div>
    </>
  );
}
