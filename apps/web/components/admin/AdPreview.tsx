'use client';
/**
 * "Qanday ko'rinadi": varaqdagi qoralamaning pastki bannerini ikki kenglikda ko'rsatadi.
 *
 * Nega kerak: hozir bannerni ko'rish uchun prodda maxfiy oyna ochib, ommaviy sahifani topib,
 * kechikish vaqtini kutishga to'g'ri keladi. Telefondagi kesilish esa u yerda umuman
 * ko'rinmaydi, holbuki telefon bu formatning asosiy ekrani: 390 px da rasmning yon
 * tomonlari kesiladi va rasm ichidagi yozuv chetda qolib ketishi mumkin.
 *
 * Qaysi yo'l tanlandi va nega. Birinchi yo'l - haqiqiy BottomAd ni kichik o'rov ichida
 * qayta ishlatish - bo'lmadi: u AdSlot.tsx dan eksport qilinmagan va sahifaga
 * payvandlangan. Ekranga yopishib turadi (fixed, ya'ni ramkaga sig'maydi), ko'rilgan va
 * yopilgan sanog'ini serverga yuboradi va yopilganda brauzer xotirasiga jim vaqtni yozadi.
 * Panelda shundayligicha ishlatsak, egasining sinovi sotuvchiga ko'rsatiladigan songa
 * qo'shilib ketardi va haqiqiy banner egasining o'z brauzerida jim vaqt davomida
 * ko'rinmay qolardi. Uni "sanoqsiz, ramka ichida" ishlashga o'rgatish uchun uchta yangi
 * sozlama kerak bo'lardi, ya'ni ishlab turgan komponentni panel uchun qayta yozish kerak.
 * Shuning uchun ikkinchi yo'l: iframe emas (u sahifaning uslublarini olib kirmaydi va
 * bitta rasm uchun ortiqcha), oddiy o'lchovli quti. Ichidagi sinf satrlari BottomAd
 * dagining aynan o'zi: ko'rinish bir joyda o'zgarsa, bu yerda ham shunday bo'lishi kerak.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AD_ROW, BottomAdRow } from '@/components/site/AdSlot';

export function AdPreview({ url, delaySec, showSec, onDone }: {
  url: string; delaySec: number; showSec: number; onDone: () => void;
}) {
  const ta = useTranslations('admin.ads');
  const close = useTranslations('a11y')('close');
  // Yorliq ommaviy kalitdan: bannerda qanday yozilsa, ko'rsatishda ham shunday chiqsin
  const label = useTranslations('ads')('label');

  // Sonlar maydondan keladi: bo'sh, kasr yoki manfiy qiymat sanoqni buzmasin
  const wait = Math.max(0, Math.round(delaySec) || 0);
  const stay = Math.max(0, Math.round(showSec) || 0);
  const [shown, setShown] = useState(wait === 0);
  const [left, setLeft] = useState(wait === 0 ? stay : wait);

  /*
   * Bitta soat: kechikishni ham, turish muddatini ham shu sanoq yuritadi. Egasi sonni
   * shu yerda his qiladi, shuning uchun qolgan soniya ekranda ko'rinadi: aks holda tugmani
   * bosib, sakkiz soniya hech narsa bo'lmaganda odam buzuq deb o'ylaydi va yana bosadi.
   * stay = 0 bo'lsa banner chiqqandan keyin sanoq to'xtaydi: u o'zi yopilmaydi.
   */
  const counting = !shown || stay > 0;
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(id);
  }, [counting]);

  useEffect(() => {
    if (!counting || left > 0) return;
    if (!shown) { setShown(true); setLeft(stay); return; }
    onDone();
  }, [counting, left, shown, stay, onDone]);

  const sec = Math.max(left, 0); // soat bir marta -1 ga tushib ketishi mumkin, u ekranga chiqmasin
  const status = !shown ? ta('previewWait', { sec }) : stay ? ta('previewLeft', { sec }) : ta('previewStay');

  /**
   * Bannerning o'zi. box - tashqi o'lcham, ichi ikki kenglikda bir xil.
   *
   * phone: telefonda pastda tizim chizig'i uchun joy qoladi va media shuncha pastroq
   * bo'ladi; kompyuterda env() nol, ya'ni bu yerda eng katta holat ko'rinadi.
   */
  /*
   * Ramka: tashqi o'lchamni shu yer beradi, ichki ko'rinishni esa bannerning o'zi
   * (BottomAdRow). Sinflar bu yerda takrorlanmaydi: takrorlansa, sahifadagi ko'rinish
   * o'zgarganda namuna jimgina eskirar va egasi prodda boshqa narsa ko'rardi.
   *
   * phone: telefonda pastda tizim chizig'i uchun joy qoladi; kompyuterda env() nol.
   */
  const frame = (v: 'phone' | 'desk') => (
    <div
      className={`pointer-events-auto ${AD_ROW[v].box}`}
      style={v === 'phone' ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' } : undefined}
    >
      {/* Havolasiz: namunada bosilganda boshqa saytga ketib qolmasin va sanoq ham ketmasin.
          Yopish tugmasi haqiqiy o'lchamda: egasi barmoqqa qulayligini shu yerda ko'radi. */}
      <BottomAdRow url={url} label={label} closeLabel={close} reduced={false} link={AD_ROW[v].link} onClose={onDone} />
    </div>
  );

  return (
    <>
      <span className="font-mono text-xs text-muted">{status}</span>
      {shown ? (
        /*
         * Ekran pastida, varaq (z-50) ustida: banner ham sahifaning pastida turadi.
         * pointer-events-none tashqi qutida: yorliqlar orasidagi bo'sh joy varaqning
         * maydonlarini to'smasin, faqat bannerning o'zi bosiladi.
         * px-3: kompyuter kengligi shu bilan birga haqiqiy min(100% - 1.5rem, 980px) bo'ladi.
         */
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-1 px-3 pb-3">
          <p className="rounded-full bg-navy px-2.5 py-0.5 font-mono text-[11px] text-white">{ta('previewPhone')}</p>
          {frame('phone')}
          <p className="rounded-full bg-navy px-2.5 py-0.5 font-mono text-[11px] text-white">{ta('previewDesk')}</p>
          {frame('desk')}
        </div>
      ) : null}
    </>
  );
}
