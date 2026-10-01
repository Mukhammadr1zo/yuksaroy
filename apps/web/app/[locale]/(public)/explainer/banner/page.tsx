import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SelfAd } from '@/components/landing/SelfAd';

/*
 * O'z reklamamizni videoga olish uchun yalong'och sahifa (8:1 pastki banner).
 *
 * Nega alohida sahifa: yozib oluvchi vosita ELEMENTNI emas, butun oynani yozadi.
 * Oyna 1200x150 qilib ochiladi va bo'lak shu oynani to'liq egallaydi, ya'ni kadrda
 * bannerdan boshqa narsa qolmaydi.
 *
 * Hech qayerdan havola qilinmaydi va sitemap ga tushmaydi: manzil faqat qo'lda ochiladi.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SelfAdShotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      {/*
        Sahifa (public) qobig'i ichida turadi: tepada Header, pastda Footer, reklama joylari va
        yordam tugmasi chiziladi. Ular uchun alohida qobiq yasalmadi, chunki qobiq butun papkaga
        ta'sir qiladi, kerak bo'lgani esa bitta manzil. Butun oynani egallagan qatlam ularning
        ustiga tushadi (sayt chegarasi z-50 gacha, shuning uchun z-60). Uslub joyida chiziladi:
        href va precedence berilsa React uni <head> ga ko'chirar va bu manzildan chiqqandan
        keyin ham butun sayt aylanmay qolardi.
      */}
      <style>{'body{overflow:hidden}'}</style>
      {/* bg-white: banner saytda oq katakda turadi (AdSlot pastki banner foni), shuning uchun
          kadr cheti ham oq. Qora fon haqiqiy joydan boshqa ko'rinishni berardi. */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-white">
        <SelfAd />
      </div>
    </>
  );
}
