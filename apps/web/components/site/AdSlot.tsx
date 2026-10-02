'use client';
/**
 * Reklama: tafsilot sahifasidagi yon blok (AdSlot) va sahifa bo'ylab turadigan uch joy
 * (SiteAds): chap ustun, o'ng ustun va pastdan chiquvchi banner.
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
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { XIcon } from '@phosphor-icons/react';
import { pushImpression } from '@/components/catalog/Impressions';
import { usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getCompare, getCompareServer, subscribeCompare } from '@/lib/compare';
import { getConsent, getConsentServer, subscribeConsent } from '@/lib/consent';

type Ad = { id: string; title: string; body: string | null; imageUrl: string | null; href: string };
/*
 * Pastki bannerda sarlavha YO'Q: ekranda faqat media turadi, matn chizilmaydi.
 * body esa havolaning nomi bo'ladi, ya'ni ekran o'quvchi "Reklama: ..." deb o'qiydi.
 * Uch vaqt sonini panel beradi: egasi ularni bir joyda o'zgartirsin, kod qayta yozilmasin.
 */
type BottomAdData = { id: string; body: string | null; imageUrl: string | null; href: string; delaySec: number; showSec: number; quietHours: number };
type Rails = { left: Ad | null; right: Ad | null; bottom: BottomAdData | null };

/** Yopilgani shu kalitda: ichida faqat vaqt soni, qaysi banner ekani saqlanmaydi. */
const QUIET_KEY = 'ys-ad-quiet';

/**
 * Bosilgani va yopilgani: "necha marta bosildi", "necha marta turtib tashlandi".
 *
 * Serverda kunlik jamlangan bitta son qoladi (mavjud Impression jadvali): IP, sessiya
 * yoki sahifa manzili saqlanmaydi va uchinchi tomon piksellari yo'q, ya'ni maxfiylik
 * sahifasidagi va'da buzilmaydi.
 *
 * Nega navbat emas, to'g'ridan-to'g'ri fetch: bosilganda odam shu zahoti boshqa saytga
 * ketadi va navbatning ikki soniyalik kutishi bu yerda ortiqcha xavf. keepalive so'rovni
 * yo'lda uzilishdan saqlaydi. Xato jim yutiladi: sanoq tufayli havola ishlamay qolmasin.
 * Ko'rilgani esa navbatdan ketadi (pastdagi useViewBeacon ga qarang).
 */
function beacon(targetId: string, surface: 'click' | 'close') {
  fetch('/api/v1/events/impressions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [{ kind: 'ad', targetId, surface }] }),
    keepalive: true,
  }).catch(() => {});
}

/** Video fayllari kengaytmadan aniqlanadi: media turini alohida ustunda saqlash shart emas. */
export const isVideo = (url: string) => /\.(mp4|webm)(\?|#|$)/i.test(url);

/**
 * Banner o'zi: rasm, GIF yoki ovozsiz video.
 *
 * Video ovozsiz va boshqaruvsiz: reklama o'zi ovoz chiqarsa odam sahifani yopadi.
 * Harakatni kamaytirishni so'ragan odamga esa o'zi bosib ko'radi, aks holda biz
 * uning tizim sozlamasini reklama uchun buzgan bo'lardik.
 *
 * fill: pastki bannerning balandligi tashqi o'rovda qat'iy belgilangan, shuning uchun
 * media shu balandlikni to'liq egallaydi. Yon ustunda esa balandlik rasmning o'zidan keladi.
 */
function Media({ url, reduced, fill }: { url: string; reduced: boolean; fill?: boolean }) {
  /*
   * Pastki bannerda object-contain, yon ustunda object-cover.
   * Sabab: pastki banner qat'iy balandlikda turadi va cover bo'lsa brend bergan
   * rasmning cheti qirqilib ketardi. Yon ustunda esa kenglik qat'iy va balandlik
   * erkin, ya'ni qirqiladigan narsa yo'q.
   */
  const cls = `w-full rounded-xl${fill ? ' h-full object-contain' : ' object-cover'}`;
  if (!isVideo(url)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" className={cls} />;
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
      className={cls}
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

/**
 * Ko'rildi mayog'i.
 *
 * Nega IntersectionObserver, nega oddiy mount emas: yon ustunlar 1600 px dan tor
 * ekranda CSS bilan yashirin (display:none) va sahifa pastidagi blok umuman
 * ko'rinmasligi mumkin. Yashirin banner hech qachon kesishmaydi, ya'ni "ko'rildi"
 * deb sanalmaydi. Sotuvchiga aynan shu son kerak: joy chindan ko'rindimi.
 *
 * Kalitda yo'l ham bor, faqat banner id emas: yon ustunlar ommaviy layoutda turadi,
 * ya'ni sahifadan sahifaga o'tganda qayta yaratilmaydi. id ning o'zi kalit bo'lsa ular
 * butun seansga bir marta sanalardi, sahifa ichidagi blok esa har sahifada. Panelda
 * ikkalasi bitta "Ko'rildi" ustunida yonma yon turadi, ya'ni o'lchov bir xil bo'lishi
 * shart: bitta ko'rsatilgan sahifa = bitta ko'rildi.
 *
 * on: pastki banner hali kechikish vaqtini kutayotganda element DOM da yo'q, shuning
 * uchun kuzatuv ham keyin boshlanadi.
 */
function useViewBeacon(ref: React.RefObject<HTMLElement | null>, adId: string, path: string, on = true) {
  const sentFor = useRef<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    const key = `${adId}|${path}`;
    if (!on || !el || sentFor.current === key) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || sentFor.current === key) return;
      sentFor.current = key;
      io.disconnect();
      // Katalog mayoqlari bilan bitta navbat: bir sahifadagi uch banner bitta so'rovda ketadi
      pushImpression({ kind: 'ad', targetId: adId, surface: 'view' });
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, adId, path, on]);
}

/** Bosiladigan banner. Yozuv majburiy: reklama reklama sifatida tanilishi kerak. */
function Banner({ ad, label, reduced }: { ad: Ad; label: string; reduced: boolean }) {
  const box = useRef<HTMLAnchorElement>(null);
  const path = usePathname();
  useViewBeacon(box, ad.id, path);

  return (
    <>
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <a
        ref={box}
        href={ad.href} target="_blank" rel="noopener noreferrer sponsored"
        // preventDefault yo'q: mayoq yuboriladi, havola o'z ishini qiladi
        onClick={() => beacon(ad.id, 'click')}
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
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    let alive = true;
    // Til so'rovga qo'shiladi: yon blok yozuvi rasm ichida, ya'ni ruscha banner
    // o'zbekcha sahifada chiqmasligi kerak. Server tanlaydi, brauzer emas.
    api<{ ad: Ad | null }>(`/ads?placement=${placement}&locale=${locale}`)
      .then((r) => { if (alive) setAd(r.ad); })
      .catch(() => {}); // reklama yo'qligi sahifaning ishiga ta'sir qilmaydi
    return () => { alive = false; };
  }, [placement, locale]);

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
function SideRails({ left, right, label, reduced }: { left: Ad | null; right: Ad | null; label: string; reduced: boolean }) {
  if (!left && !right) return null;
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
      {left ? <aside className={side}><Banner ad={left} label={label} reduced={reduced} /></aside> : <div className="w-28" />}
      {right ? <aside className={side}><Banner ad={right} label={label} reduced={reduced} /></aside> : <div className="w-28" />}
    </div>
  );
}

/*
 * Ochiq oyna DOM dan aniqlanadi: chat va yordam oynalari o'z holatini tashqariga bermaydi.
 * Aynan shu naqsh HelpWidget da bor, lekin u yerdan import qilinmadi: bosh sahifada
 * yordam vidjeti yo'q va import butun vidjetni ikonkalari bilan landing to'plamiga
 * tortib kelardi.
 */
const subscribeDom = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.body, { childList: true, subtree: true });
  return () => mo.disconnect();
};
// role="dialog" ning hammasi: egasi bilan chat, yordam oynasi, surat ko'rgichi.
// Odam boshqa ish qilayotganda bannerni ustiga chiqarmaymiz.
const dialogOpen = () => document.querySelector('[role="dialog"]') !== null;

/**
 * Forma to'ldiriladigan va holat kuzatiladigan sahifalar: bu yerda banner umuman chiqmaydi.
 *
 * Ro'yxat sahifada forma bor yoki yo'qligiga qarab tuzilgan, nomiga qarab emas:
 * /contact ContactForm ni, /quote hisob formasini, /cargo/... va /services/request...
 * so'rov va taklif formasini chizadi, /m/ esa ochiq holat sahifasi. /booking da forma
 * yo'q (faqat havola va jadval), shuning uchun u yerda banner chiqaveradi.
 *
 * Chegara aniq: /contact va /quote da ichki sahifa yo'q ($), /cargo va /services da esa
 * ro'yxat sahifasining o'zi ochiq qoladi va faqat ichkarisi yopiladi.
 */
/*
 * Bannerning ko'rinishi BITTA joyda: yorliq, media va yopish tugmasi.
 *
 * Nega alohida: panelning "Qanday ko'rinadi" tugmasi ham aynan shuni chizadi. Sinflar
 * ikki faylda takrorlansa, ko'rinish bir joyda o'zgarganda namuna jimgina eskirardi va
 * egasi prodda boshqa narsa ko'rardi. Tashqi o'lcham esa har joyda boshqa: sahifada u
 * ekranga yopishadi, panelda esa ramkaga sig'adi. Shuning uchun o'lcham tashqaridan
 * beriladi, ichki ko'rinish esa shu yerda qoladi.
 */
export const AD_ROW = {
  live: {
    box: 'flex max-h-[22dvh] min-h-[3.75rem] w-full items-center gap-2 border-t border-line bg-white p-2 shadow-2xl sm:h-24 sm:w-[min(100%-1.5rem,980px)] sm:rounded-card sm:border',
    // Telefonda balandlikni rasmning o'z nisbati beradi (8:1), 22dvh esa faqat tepa chegara:
    // qat'iy 22dvh bo'lsa baland telefonda quti 180 px ga cho'zilib, rasm o'rtasidan
    // qirqilardi. Kompyuterda aksincha, balandlik qat'iy 96 px.
    link: 'aspect-[8/1] sm:aspect-auto sm:h-full',
  },
  // Panel namunasi: sahifadagi ikki holat ramka ichida yonma yon ko'rsatiladi.
  // Telefon kengligi qat'iy 390 px, balandligi esa sahifadagidek mazmundan keladi.
  phone: { box: 'flex min-h-[3.75rem] max-h-[186px] w-[390px] max-w-full items-center gap-2 border-t border-line bg-white p-2 shadow-2xl', link: 'aspect-[8/1]' },
  desk: { box: 'flex h-24 w-[min(100%,980px)] items-center gap-2 rounded-card border border-line bg-white p-2 shadow-2xl', link: 'h-full' },
} as const;

/** Yorliq, media va yopish tugmasi. Tashqi o'lchamni chaqiruvchi beradi. */
export function BottomAdRow({ url, label, closeLabel, reduced, href, body, link, onLinkClick, onClose }: {
  url: string | null; label: string; closeLabel: string; reduced: boolean;
  href?: string; body?: string | null; link: string;
  onLinkClick?: () => void; onClose: () => void;
}) {
  const media = url ? <Media url={url} reduced={reduced} fill /> : null;
  const cls = `block max-h-full min-w-0 flex-1 overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-teal/40 ${link}`;
  return (
    <>
      {/* Yorliq brend rasmining USTIDA emas, YONIDA: ustida turganda u brendning o'z
          yozuvini yopib qo'yardi. O'chirilmaydi: reklama reklama sifatida tanilishi kerak.
          aria-hidden: nomi havolaning o'zida bor, ekran o'quvchi ikki marta aytmasin. */}
      <span aria-hidden="true" className="shrink-0 rounded bg-sand px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">{label}</span>
      {/* Havola yorliqdan keyin, yopish tugmasi oxirida: Tab bilan avval reklamaning o'zi keladi */}
      {href
        ? <a href={href} target="_blank" rel="noopener noreferrer sponsored" aria-label={body ? `${label}: ${body}` : label} onClick={onLinkClick} className={cls}>{media}</a>
        : <span className={cls}>{media}</span>}
      {/* 44x44: repodagi tap-40 yordamchisi 40 px beradi, bu yerda esa kamroq bo'lmasligi
          kerak. Banner ekran chetida turadi va barmoq yanglishib havolaga tegib ketmasin. */}
      <button
        type="button" onClick={onClose} aria-label={closeLabel}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-muted transition hover:bg-sand hover:text-navy"
      >
        <XIcon size={18} weight="bold" aria-hidden="true" />
      </button>
    </>
  );
}

const BUSY_PATH = /^\/(contact|quote)$|^\/(cargo|m|status)\/|^\/services\/request/;

/**
 * Yashirin varaqda yurmaydigan taymer.
 *
 * Nega kerak: fon varaqda setTimeout to'xtamaydi, faqat sekinlashadi. Shunda banner
 * odam ko'rmagan varaqda chiqib, o'sha yerda o'zi yopilardi va yopilish bilan birga
 * o'n ikki soatlik jim vaqt yozilardi: odam qaytganda joy allaqachon o'lik bo'lardi.
 * Buni Ctrl bilan yangi varaqda ochilgan har qanday havola keltirib chiqaradi.
 *
 * Shuning uchun hisob faqat varaq ko'rinib turganda yuradi va yashirilganda nolga
 * qaytadi: reklama ko'rilishi kerak, o'tib ketishi emas.
 *
 * ms = 0 haqiqiy qiymat (darhol), shuning uchun "o'chirilgan" holat `on` orqali beriladi.
 */
function useAwakeTimeout(ms: number, fn: () => void, on: boolean) {
  useEffect(() => {
    if (!on) return;
    let id = 0;
    const arm = () => {
      if (document.hidden) { clearTimeout(id); id = 0; return; }
      if (!id) id = window.setTimeout(fn, ms);
    };
    arm();
    document.addEventListener('visibilitychange', arm);
    return () => { clearTimeout(id); document.removeEventListener('visibilitychange', arm); };
  }, [ms, fn, on]);
}

/**
 * Pastdan chiquvchi banner.
 *
 * Bu modal oyna EMAS: fokus qamalmaydi va sahifaning qolgani ishlayveradi. Shuning uchun
 * role="dialog" ham yo'q, oddiy nomlangan yonaki bo'lim (aside): ekran o'quvchiga oyna
 * deb va'da bersak, o'zini oyna kabi tutishi kerak bo'lardi.
 *
 * Matn va sarlavha chizilmaydi: pastki chiziq tor va u yerda ikki qator matn baribir
 * o'qilmaydi. Nom havolaning o'zida (aria-label), rasm esa bezak (alt bo'sh).
 */
function BottomAd({ ad, label, closeLabel, reduced }: { ad: BottomAdData; label: string; closeLabel: string; reduced: boolean }) {
  const path = usePathname();
  const compare = useSyncExternalStore(subscribeCompare, getCompare, getCompareServer);
  const dialog = useSyncExternalStore(subscribeDom, dialogOpen, () => false);
  const consent = useSyncExternalStore(subscribeConsent, getConsent, getConsentServer);
  const [shown, setShown] = useState(false);
  const box = useRef<HTMLElement>(null);

  // Savat solishtirish sahifasida chizilmaydi (CompareTray bilan bir xil shart)
  const trayShown = !path.includes('/compare') && Object.values(compare).some((items) => items.length > 0);
  const busy = dialog || trayShown || BUSY_PATH.test(path);
  const visible = shown && !busy;
  useViewBeacon(box, ad.id, path, visible);

  /*
   * Jim vaqt brauzer xotirasidan bir marta, mount dan keyin o'qiladi. Boshlang'ich
   * qiymat "jim": serverda localStorage yo'q va birinchi chizishda banner chiqmasligi
   * kerak. Yopilgandan keyin bu holat shu seansda ham "jim" bo'lib qoladi, ya'ni
   * varaqdan chiqib qaytganda banner qayta chiqmaydi.
   */
  const [quiet, setQuiet] = useState(true);
  useEffect(() => {
    /*
     * Rozilik berilmaguncha jim holicha qoladi, ya'ni banner chizilmaydi. Sabab quyidagi
     * "yoza olmasak chiqmaydi" qoidasining aynan o'zi: jim vaqt ys-ad-quiet ga yoziladi va
     * roziliksiz biz uni yoza olmaymiz. Yozuvsiz esa yopilgani eslanmaydi va banner har
     * sahifada qaytib chiqardi. Odam rozi bo'lganda bu effekt qayta yuradi.
     */
    if (consent !== 'yes') { setQuiet(true); return; }
    try {
      const until = Number(localStorage.getItem(QUIET_KEY) || 0);
      // Bor sonni qaytib yozamiz: maxfiy oynada o'qish ishlashi mumkin, lekin yozish
      // ishlamasa yopilgani eslanmaydi va banner har sahifada qaytib chiqardi.
      // Bezovta qilgandan ko'ra umuman chiqmagani yaxshi.
      localStorage.setItem(QUIET_KEY, String(until));
      setQuiet(until > Date.now());
    } catch { /* yoza olmasak jim holicha qoladi va banner chiqmaydi */ }
  }, [consent]);

  /**
   * Yopish. Mayoq faqat odam bosganda ketadi: showSec tugab o'zi ketgani "turtib
   * tashlandi" degani emas va bu ikki sonni aralashtirish sotuvchini chalg'itadi.
   * Jim vaqt esa ikki holatda ham belgilanadi, aks holda banner har sahifada qaytardi.
   */
  const hide = useCallback((byUser: boolean) => {
    setShown(false);
    setQuiet(true);
    if (byUser) beacon(ad.id, 'close');
    try { localStorage.setItem(QUIET_KEY, String(Date.now() + ad.quietHours * 3600_000)); } catch { /* bu holatda banner umuman chizilmagan */ }
  }, [ad.id, ad.quietHours]);

  // Kechikish: varaq ko'rinib turgandan delaySec soniya keyin chiqadi
  const show = useCallback(() => setShown(true), []);
  useAwakeTimeout(ad.delaySec * 1000, show, !busy && !quiet);

  // O'zi ketishi. showSec = 0 bo'lsa o'zi yopilmaydi: odam o'zi yopadi
  const selfHide = useCallback(() => hide(false), [hide]);
  useAwakeTimeout(ad.showSec * 1000, selfHide, visible && ad.showSec > 0);

  /*
   * To'qnashuv: banner qancha joy egallaganini hujjat ildizidagi bitta o'lchamga yozamiz.
   * Ro'yxatdan o'tish taklifi, yordam tugmasi va yordam oynasi shu o'lchamni o'z pastki
   * masofasiga qo'shadi, ya'ni balandlik bir joyda hisoblanadi va uch joyda takrorlanmaydi.
   * ResizeObserver kerak: 22dvh telefon burilganda va manzil satri yashiringanda o'zgaradi.
   */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const root = document.documentElement.style;
    const set = () => root.setProperty('--ad-bottom', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); root.removeProperty('--ad-bottom'); };
  }, [visible]);

  if (!visible) return null;
  /*
   * Esc bannerning O'ZIDA tinglanadi (onKeyDown), window da emas: bu modal oyna emas va
   * sahifadagi menyu, qidiruv ro'yxati va maydonlar Esc ni o'zi uchun ishlatadi. Window da
   * tinglasak odam menyuni yopganda banner ham yopilib, serverga yolg'on "turtib tashlandi"
   * mayog'i ketardi va 12 soatlik jim vaqt bekorga yozilardi. aside fokuslanmaydi, ya'ni
   * bu hodisa faqat havola yoki yopish tugmasi fokusda bo'lganda keladi.
   */
  return (
    <aside
      ref={box}
      aria-label={label}
      onKeyDown={(e) => { if (e.key === 'Escape') hide(true); }}
      className={`fixed inset-x-0 bottom-0 z-40 mx-auto sm:bottom-3 ${AD_ROW.live.box}`}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
    >
      <BottomAdRow
        url={ad.imageUrl} label={label} closeLabel={closeLabel} reduced={reduced}
        href={ad.href} body={ad.body} link={AD_ROW.live.link}
        onLinkClick={() => beacon(ad.id, 'click')} onClose={() => hide(true)}
      />
    </aside>
  );
}

/**
 * Sahifa bo'ylab turadigan reklama: bitta so'rov, uch joy.
 *
 * Nega bitta so'rov: uch joy uchun uch so'rov IP chelagini (daqiqasiga 60) ommaviy
 * operator manzilida tez to'ldirardi va 429 jim yo'qolib, brendga ko'rsatiladigan son
 * kam chiqardi.
 *
 * Til so'rovga qo'shiladi: reklama faqat o'z tilida chiqadi, boshqa tildagi banner esa
 * o'qilmaydi va bekorga sanaladi.
 */
export function SiteAds() {
  const t = useTranslations('ads');
  const a = useTranslations('a11y');
  const locale = useLocale();
  const reduced = useReducedMotion();
  const [rails, setRails] = useState<Rails>({ left: null, right: null, bottom: null });

  useEffect(() => {
    let alive = true;
    api<Rails>(`/ads/rails?locale=${locale}`)
      .then((r) => { if (alive) setRails(r); })
      .catch(() => {}); // reklama yo'qligi sahifaning ishiga ta'sir qilmaydi
    return () => { alive = false; };
  }, [locale]);

  return (
    <>
      <SideRails left={rails.left} right={rails.right} label={t('label')} reduced={reduced} />
      {/* Media yo'q bo'lsa pastki banner bo'sh chiziq bo'lib qolardi: matn u yerda chizilmaydi */}
      {rails.bottom?.imageUrl ? <BottomAd ad={rails.bottom} label={t('label')} closeLabel={a('close')} reduced={reduced} /> : null}
    </>
  );
}
