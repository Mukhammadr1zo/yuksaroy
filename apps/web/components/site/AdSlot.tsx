'use client';
/**
 * Reklama: tafsilot sahifasidagi yon blok (AdSlot) va sahifaning ikki yonidagi
 * ustunlar (SideRails).
 *
 * Mijoz komponenti, chunki javob kim so'raganiga bog'liq: obunachiga reklama
 * ko'rsatilmaydi va buni server sessiyaga qarab hal qiladi. Server komponenti esa
 * ommaviy sahifada sessiyani ko'rmaydi.
 *
 * Uchinchi tomon kodi, pikseli va kuzatuvchisi yo'q: maxfiylik sahifasida "reklama
 * kuzatuvchilari yo'q" deb yozilgan va bu blok shu yozuvni buzmaydi. Banner fayli
 * ham o'z serverimizda turadi, ya'ni brauzer begona manzilga murojaat qilmaydi.
 * Ko'rildi va bosildi sanog'i o'z serverimizga boradi va u yerda kunlik jamlangan
 * son bo'lib qoladi (pastdagi beacon ga qarang).
 *
 * Reklama bo'lmasa hech narsa chizilmaydi: bo'sh ramka sahifani buzadi.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { pushImpression } from '@/components/catalog/Impressions';
import { usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api';

type Ad = { id: string; title: string; body: string | null; imageUrl: string | null; href: string };

/**
 * Bosilgani: "necha marta bosildi" degan savolga javob.
 *
 * Serverda kunlik jamlangan bitta son qoladi (mavjud Impression jadvali): IP, sessiya
 * yoki sahifa manzili saqlanmaydi va uchinchi tomon piksellari yo'q, ya'ni maxfiylik
 * sahifasidagi va'da buzilmaydi.
 *
 * Nega navbat emas, to'g'ridan-to'g'ri fetch: bosilganda odam shu zahoti boshqa saytga
 * ketadi va navbatning ikki soniyalik kutishi bu yerda ortiqcha xavf. keepalive so'rovni
 * yo'lda uzilishdan saqlaydi. Xato jim yutiladi: sanoq tufayli havola ishlamay qolmasin.
 * Ko'rilgani esa navbatdan ketadi (pastdagi Banner ga qarang).
 */
function clickBeacon(targetId: string) {
  fetch('/api/v1/events/impressions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [{ kind: 'ad', targetId, surface: 'click' }] }),
    keepalive: true,
  }).catch(() => {});
}

/** Video fayllari kengaytmadan aniqlanadi: media turini alohida ustunda saqlash shart emas. */
const isVideo = (url: string) => /\.(mp4|webm)(\?|#|$)/i.test(url);

/**
 * Banner o'zi: rasm, GIF yoki ovozsiz video.
 *
 * Video ovozsiz va boshqaruvsiz: reklama o'zi ovoz chiqarsa odam sahifani yopadi.
 * Harakatni kamaytirishni so'ragan odamga esa o'zi bosib ko'radi, aks holda biz
 * uning tizim sozlamasini reklama uchun buzgan bo'lardik.
 */
function Media({ url, reduced }: { url: string; reduced: boolean }) {
  if (!isVideo(url)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" className="w-full rounded-xl object-cover" />;
  }
  return (
    <video
      src={url}
      muted
      playsInline
      loop={!reduced}
      autoPlay={!reduced}
      controls={reduced}
      preload="metadata"
      className="w-full rounded-xl object-cover"
    />
  );
}

/** Tizim sozlamasi: harakatni kamaytirish so'ralganmi. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Bosiladigan banner. Yozuv majburiy: reklama reklama sifatida tanilishi kerak. */
function Banner({ ad, label, reduced }: { ad: Ad; label: string; reduced: boolean }) {
  const box = useRef<HTMLAnchorElement>(null);
  /*
   * Kalitda yo'l ham bor, faqat banner id emas.
   *
   * Yon ustunlar ommaviy layoutda turadi, ya'ni sahifadan sahifaga o'tganda qayta
   * yaratilmaydi: id ning o'zi kalit bo'lsa ular butun seansga bir marta sanalardi,
   * sahifa ichidagi blok esa har sahifada. Panelda ikkalasi bitta "Ko'rildi" ustunida
   * yonma yon turadi, ya'ni o'lchov bir xil bo'lishi shart: bitta ko'rsatilgan sahifa
   * = bitta ko'rildi.
   */
  const path = usePathname();
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    const el = box.current;
    const key = `${ad.id}|${path}`;
    if (!el || sentFor.current === key) return;
    /*
     * Nega IntersectionObserver, nega oddiy mount emas: yon ustunlar 1600 px dan tor
     * ekranda CSS bilan yashirin (display:none) va sahifa pastidagi blok umuman
     * ko'rinmasligi mumkin. Yashirin banner hech qachon kesishmaydi, ya'ni "ko'rildi"
     * deb sanalmaydi. Sotuvchiga aynan shu son kerak: joy chindan ko'rindimi.
     */
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || sentFor.current === key) return;
      sentFor.current = key;
      io.disconnect();
      // Katalog mayoqlari bilan bitta navbat: bir sahifadagi uch banner bitta so'rovda ketadi
      pushImpression({ kind: 'ad', targetId: ad.id, surface: 'view' });
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ad.id, path]);

  return (
    <>
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <a
        ref={box}
        href={ad.href} target="_blank" rel="noopener noreferrer sponsored"
        // preventDefault yo'q: mayoq yuboriladi, havola o'z ishini qiladi
        onClick={() => clickBeacon(ad.id)}
        className="mt-2 block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
      >
        {ad.imageUrl ? <span className="mb-2 block"><Media url={ad.imageUrl} reduced={reduced} /></span> : null}
        <span className="block font-semibold text-navy hover:underline">{ad.title}</span>
        {ad.body ? <span className="mt-1 block text-sm text-muted">{ad.body}</span> : null}
      </a>
    </>
  );
}

export function AdSlot({ placement }: { placement: 'terminal-aside' | 'listing-aside' }) {
  const t = useTranslations('ads');
  const reduced = useReducedMotion();
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ ad: Ad | null }>(`/ads?placement=${placement}`)
      .then((r) => { if (alive) setAd(r.ad); })
      .catch(() => {}); // reklama yo'qligi sahifaning ishiga ta'sir qilmaydi
    return () => { alive = false; };
  }, [placement]);

  if (!ad) return null;
  return (
    <aside className="rounded-2xl border border-line bg-white p-4">
      <Banner ad={ad} label={t('label')} reduced={reduced} />
    </aside>
  );
}

/**
 * Sahifaning ikki yonidagi ustun.
 *
 * Faqat keng ekranda: mazmun ustuni 1280px va uning yonida banner uchun joy ochilishi
 * uchun oyna 1600px dan keng bo'lishi kerak. Tor ekranda chizilmaydi, chunki mazmunni
 * banner uchun siqish katalogni va xaritani buzardi.
 *
 * Bosiladigan joy faqat bannerning o'zi (pointer-events): ustun ustidagi bo'sh joy
 * sahifaning tugmalarini to'smaydi. z indeksi pastda: sarlavha va oynalar ustida turadi.
 */
export function SideRails() {
  const t = useTranslations('ads');
  const reduced = useReducedMotion();
  const [rails, setRails] = useState<{ left: Ad | null; right: Ad | null }>({ left: null, right: null });

  useEffect(() => {
    let alive = true;
    api<{ left: Ad | null; right: Ad | null }>('/ads/rails')
      .then((r) => { if (alive) setRails(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!rails.left && !rails.right) return null;
  /*
   * Kenglik ekranga qarab: 1536 px da mazmun ustuni (1280) yonida har tomonda 128 px
   * qoladi, shuning uchun u yerda banner 112 px; 1600 dan boshlab 160 px.
   * Ilgari faqat 1600 dan chizilardi va ko'p noutbukda reklama umuman ko'rinmasdi:
   * egasi bannerni sotib qo'yib, o'z ekranida hech narsa ko'rmagan edi.
   */
  const side = 'pointer-events-auto w-28 rounded-2xl border border-line bg-white p-2 [@media(min-width:1600px)]:w-40 [@media(min-width:1600px)]:p-3';
  return (
    <div className="pointer-events-none fixed inset-x-0 top-28 z-0 mx-auto hidden max-w-[1660px] justify-between px-3 [@media(min-width:1536px)]:flex">
      {/* Bo'sh tomon ham joy egallaydi: bitta banner sotilgan bo'lsa u o'z yonida qolsin */}
      {rails.left ? <aside className={side}><Banner ad={rails.left} label={t('label')} reduced={reduced} /></aside> : <div className="w-28" />}
      {rails.right ? <aside className={side}><Banner ad={rails.right} label={t('label')} reduced={reduced} /></aside> : <div className="w-28" />}
    </div>
  );
}
