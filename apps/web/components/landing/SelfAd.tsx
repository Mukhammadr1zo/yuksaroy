import { getTranslations } from 'next-intl/server';
import { LogoMark } from '@/components/site/Logo';

/**
 * Platformaning O'Z reklamasi pastki banner formatida (8:1, 1200x150).
 *
 * NEGA kerak: pastki banner joyi sotilmagan kunlarda bo'sh turadi, bo'sh joy esa
 * saytga foyda bermaydi. Shu bo'lak videoga olinib (scripts/explainer-video.mjs --banner)
 * panelda qo'lda qo'yiladi, ya'ni joy ishlab turadi va egasi formatni brendga sotishdan
 * oldin o'z reklamasida sinab ko'radi.
 *
 * "Namuna" yorlig'i YO'Q, Explainer dan farqi shunda: bu yerda soxta nom, narx yoki
 * telefon yo'q, hammasi o'zimizning haqiqiy ma'lumotimiz.
 *
 * NEGA sm:/lg: sinflari yo'q: bu bo'lak faqat /explainer/banner sahifasida, faqat
 * 1200x150 oynada chiziladi va natijasi RASTR video. Saytda u video bo'lib ko'rsatiladi,
 * ya'ni CSS nuqtai nazaridan rasm: ekran kengligi o'zgarsa video kichrayadi, sinflar esa
 * qayta hisoblanmaydi. Shuning uchun bitta o'lcham yetarli.
 *
 * NEGA shrift kadr balandligiga nisbatan katta: AdSlot bu faylni hech qachon 1200 px da
 * ko'rsatmaydi. Kompyuterda quti 96 px baland (AD_ROW.live.box sm:h-24), ichida 80 px
 * qoladi, ya'ni 8:1 media 640x80 bo'lib chiziladi: miqyos 0.53. 390 px telefonda mediaga
 * ~258 px qoladi: miqyos 0.215. 56 px matn shu ikki holatda ~30 va ~12 px bo'ladi.
 * Shu sababli satr ikki qatorga chiqadi (text-balance) va yon elementlar ham kattalashdi:
 * belgi 72 px, manzil 34 px. truncate ATAYLAB yo'q: sig'masa ko'rinib tursin, jim
 * qirqilmasin.
 *
 * Harakat FAQAT siljish va shaffoflik, davri aynan 4 soniya. Sabab: AdSlot videoni
 * loop bilan qo'yadi (components/site/AdSlot.tsx), ya'ni 4 soniyalik fayl o'zi qaytadan
 * boshlanadi. Shuning uchun har ikki kadr ham boshi bilan oxiri bir xil holatda tugaydi:
 * matn o'z joyiga qaytadi, yorug'lik esa kadrdan chiqib ketgandan keyin ko'rinmas bo'ladi.
 * Hech narsa o'chib-yonmaydi, ya'ni video aylanganda chaqnash bo'lmaydi.
 *
 * Rang: navy fon, oq matn, teal tugmacha. Yangi rang kiritilmadi.
 * Teal fonda oq matn 4.7:1 beradi, teal-lit fonda esa 4.3:1 bo'lib normal o'lchamdagi
 * matn uchun yetmasdi, shuning uchun tugmacha teal (teal-lit faqat bezak chiziqda).
 */
const CSS = `
@keyframes sa-glide{0%,100%{transform:translateX(0)}50%{transform:translateX(16px)}}
@keyframes sa-sweep{0%{transform:translateX(-120%);opacity:0}30%{opacity:.4}70%{opacity:0}100%{transform:translateX(420%);opacity:0}}
.sa-glide{animation:sa-glide 4s ease-in-out infinite}
.sa-sweep{background:linear-gradient(90deg,transparent,var(--color-teal-lit),transparent);animation:sa-sweep 4s linear infinite}
@media (prefers-reduced-motion:reduce){.sa-glide,.sa-sweep{animation:none}}
`;

export async function SelfAd() {
  const t = await getTranslations('features.selfAd');
  return (
    // data-self-ad: yozib oluvchi skript aynan shu belgini kutadi, matnni emas (matn uch tilda boshqa)
    <div data-self-ad className="relative aspect-[8/1] w-full max-w-[1200px] overflow-hidden bg-navy">
      {/* Uslub joyida chiziladi: href va precedence berilmaydi, aks holda React uni <head> ga
          ko'chirib, bu bo'lakdan chiqqandan keyin ham qoldirardi. */}
      <style>{CSS}</style>
      {/* Yorug'lik chizig'i: o'z kengligining chetidan boshlanib kadrdan chiqib ketadi,
          ya'ni aylanish joyida ko'rinadigan sakrash yo'q. */}
      <span aria-hidden="true" className="sa-sweep pointer-events-none absolute inset-y-0 left-0 w-1/4" />
      <div className="relative flex h-full items-center gap-5 px-5">
        {/* Faqat belgi: so'z belgisi olib tashlandi, chunki brend nomini tugmachadagi
            manzilning o'zi aytadi va bo'shagan ~230 px satrga ketdi. */}
        <LogoMark size={72} className="shrink-0" />
        {/* Ikki qator: eng uzun satr ruscha va 56 px da bitta qatorga sig'maydi. 56 px -
            brauzerda o'lchangan eng katta qiymat: uchala tilda ham 2 qator va balandligi
            123 px, ya'ni 150 px kadrda 27 px zaxira qoladi. 60 px da ruscha 3 qatorga
            chiqib (196 px) kadrdan oshib ketardi. Satrga qoladigan kenglik 783 px:
            1200 - px-5 (40) - belgi (72) - gap-5 x2 (40) - tugmacha (264). */}
        <p className="sa-glide min-w-0 flex-1 text-balance font-display text-[56px] font-bold leading-[1.06] text-white">
          {t('line')}
        </p>
        <span className="shrink-0 rounded-full bg-teal px-5 py-2 font-mono text-[34px] font-semibold text-white">
          yuksaroy.uz
        </span>
      </div>
    </div>
  );
}
