'use client';
/**
 * Besh qadamli ko'rgazma: qidiruvdan bronga qadar bozor qanday ishlashi brauzer ichida
 * chizib beriladi. Video ham, rasm ham yo'q: kadrlar saytning o'z tokenlari (navy, teal,
 * sand, mono shrift) bilan yasalgan oddiy div'lar, ya'ni og'irligi bir necha kilobayt va
 * mobil internetda kutish yo'q.
 *
 * Sarlavha ichida YO'Q va prop ham qabul qilmaydi: blok /help, /for-shippers va video uchun
 * ochilgan /explainer da turadi, sarlavhani har sahifa o'zi qo'yadi. Bitta bo'limda ikkita
 * sarlavha bo'lsa hujjat tuzilishi buziladi. Bosh sahifada yo'q: u yerda HowItWorks ayni
 * shu yo'lni havolalar bilan aytadi, ikkovi yonma-yon turgani takror edi.
 *
 * Matn va harakat ataylab ajratilgan: besh qadamning sarlavhasi va matni o'ng ustunda
 * ODDIY MATN bo'lib turadi (ekran o'quvchi ham, qidiruv tizimi ham shuni o'qiydi),
 * chapdagi kadrlar esa aria-hidden bezak. Faol qadam almashganda hech narsa e'lon
 * qilinmaydi; odam o'zi bosganda yoki o'q bilan surganda fokus yangi tugmaga ko'chadi va
 * ekran o'quvchi tugmani o'qiydi. Ya'ni taymer odamning o'qishini uzmaydi.
 *
 * Kadrdagi nom, narx va telefon NAMUNA. Haqiqiy tashkilot nomi yoki haqiqiy raqam
 * ko'rsatilsa, o'z reklamamizda boshqaning ma'lumotini nashr qilgan bo'lardik; shuning
 * uchun kadr ustida doimiy "Namuna" yorlig'i turadi.
 */
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { num, pricePer, som } from '@/lib/format';

const STEPS = ['s1', 's2', 's3', 's4', 's5'] as const;
const STEP_MS = 4000; // bir qadam shuncha turadi: beshtasi ~20 soniya, keyin boshiga qaytadi
const DRAW_MS = 1200; // qadam ichidagi chizish: sanoq, yozuv va qatorlar shu vaqtda joyiga keladi
const TICK = 100; // sanoq qadami: 12 ta yangilanish sanalayotgandek ko'rinadi va protsessorni yemaydi
// 1-kadr bitta so'z bo'yicha qidiradi ("konteyner"), 2-kadr ustiga viloyatni qo'yadi. Ikki
// son shuning uchun boshqa: bir xil shartdan ikki xil natija chiqsa, ekrandagi sanoq bezakka
// aylanardi. Ikkovi ham namuna, kadr ustidagi yorliq shuni aytadi.
const FOUND = 186; // "konteyner" so'rovi bo'yicha namuna sanoq
const HITS = 12; // ustiga viloyat filtri qo'shilganda qolgan namuna soni
const LEFT = 7; // "bugun qolgan" namuna hisoblagichi
const ROWS = ['row1', 'row2', 'row3'] as const;
const PRICE = [48_000_000, 52_000_000, 45_000_000]; // tiyin: namuna tarif, pricePer uch tilda o'zi yozadi
// Qatorlar orasida 75 ms: oxirgisi 150 ms da boshlanadi, ya'ni ketma-ketlik 400 ms dan qisqa.
const DELAY = ['delay-0', 'delay-75', 'delay-150'];
/** Soxta xaritadagi 12 nuqta, foizda: kadr kengligi telefondan kompyuterga qarab o'zgaradi. */
const DOTS = [[18, 26], [30, 48], [24, 72], [42, 20], [50, 54], [46, 80], [60, 34], [68, 62], [58, 88], [78, 28], [86, 56], [74, 76]];

const ENTER = 'transition duration-300 ease-(--ease-out-quart)';
const SHOWN = 'translate-y-0 opacity-100';
const HIDDEN = 'translate-y-1 opacity-0';

/**
 * Tizim sozlamasi JS da o'qiladi, faqat CSS bilan emas. Sabab: CSS animatsiyani to'xtatadi,
 * lekin JS taymerini to'xtatmaydi, harakatni kamaytirgan odamga kerak bo'lgan narsa esa
 * aynan shu - qadamlar o'zi almashmasin. Tuzilish esa rejimga qarab O'ZGARMAYDI: boshlang'ich
 * qiymat false, ya'ni server chizgan HTML bilan gidratsiyadan keyingi birinchi kadr boshqa-boshqa
 * bo'lib qolsa, bo'lim balandligi ochilish paytida sakrardi.
 */
function useMedia(query: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const sync = () => setOn(m.matches);
    sync();
    m.addEventListener('change', sync);
    return () => m.removeEventListener('change', sync);
  }, [query]);
  return on;
}

/** Varaq fon rejimida soat yurmaydi: odam qaytganda ko'rgazma o'rtasidan boshlanib qolmasin. */
function useAwake() {
  const [awake, setAwake] = useState(true);
  useEffect(() => {
    const sync = () => setAwake(!document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  return awake;
}

export function Explainer() {
  const t = useTranslations('features.explainer');
  const locale = useLocale();
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const awake = useAwake();
  const root = useRef<HTMLDivElement>(null);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const [step, setStep] = useState(0);
  /*
   * phase 1 = qadam to'liq chizilgan. Boshlang'ich qiymat aynan 1, chunki sahifa ochilganda
   * ko'rgazma tinch turishi kerak: opacity 0 da kutib turgan element bo'lsa sahifa surati va
   * qidiruv tizimi bo'sh kadr ko'radi.
   */
  const [phase, setPhase] = useState(1);
  /*
   * Sichqoncha va klaviatura fokusi ALOHIDA saqlanadi. Bitta bayroqda ikkovi bir-birini
   * o'chirardi: odam qadam tugmasini bosib sichqonchani chetga olsa, fokus hali tugmada
   * turgani holda taymer yana yurib ketardi va fokusdagi tugmaning holati o'zgarardi.
   */
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);

  // Pastda turgan sahifada taymer jim yotadi: ko'rinmayotgan ko'rgazma bekorga aylanmasin.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** Qadamni qo'lda almashtirish: chizish boshidan boshlanadi (kamaytirilgan rejimda chizilgan holda turadi). */
  const go = useCallback((i: number) => {
    setStep(i);
    setPhase(reduced ? 1 : 0);
  }, [reduced]);

  /*
   * O'zi o'tish. Har qadamda qayta quriladi, ya'ni sichqoncha ketganda odam yana to'liq
   * 4 soniya oladi va o'qiyotgan qadam ostidan siljib ketmaydi.
   */
  const running = inView && awake && !reduced && !hover && !focus && !paused;
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => go((step + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(id);
  }, [running, step, go]);

  /*
   * Chizish soati. phase 1 ga yetganda o'zi to'xtaydi, shuning uchun bo'sh interval qolmaydi.
   * Sichqoncha, fokus va to'xtatish bu soatni to'xtatmaydi: yarim yozilgan qatorni muzlatish buzuq
   * ko'rinadi, to'xtashi kerak bo'lgan narsa qadamdan qadamga o'tish edi.
   */
  useEffect(() => {
    if (reduced || !inView || !awake || phase >= 1) return;
    const id = window.setTimeout(() => setPhase((v) => Math.min(1, v + TICK / DRAW_MS)), TICK);
    return () => clearTimeout(id);
  }, [reduced, inView, awake, phase]);

  /*
   * Faqat o'q tugmalari ushlanadi. Probelga tegilmaydi: u tugmaning o'z bosilishi, ya'ni
   * ushlab qolinsa o'ng ustundagi besh qadam tugmasi klaviatura bilan ishlamay qolardi.
   * To'xtatish uchun alohida tugma bor va u probelni tabiiy qabul qiladi.
   */
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = (step + d + STEPS.length) % STEPS.length;
    go(i);
    btns.current[i]?.focus(); // faqat qo'lda surilganda fokus ko'chadi, taymer bilan emas
  };

  /** Bir qadamning soxta ekrani. Ichida bosiladigan narsa yo'q: bu bezak, tugmalar o'ng ustunda. */
  const screen = (i: number) => {
    // Chizish qiymatini FAQAT faol kadr oladi. Umumiy bo'lsa, chiqib ketayotgan kadr 200 ms
    // so'nib turganda o'z mazmunini ham qayta chizardi: yozuv bo'shab, sanoq nolga tushardi.
    const p = i === step ? phase : 1;
    switch (i) {
      case 0: {
        const q = t('frame.query');
        return (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-2">
              <MagnifyingGlassIcon size={14} aria-hidden="true" className="shrink-0 text-muted" />
              <span className="truncate font-mono text-[11px] lg:text-sm text-ink">{q.slice(0, Math.ceil(q.length * p))}</span>
              {p < 1 && <span className="h-3.5 w-px shrink-0 bg-teal" />}
            </div>
            <p className="font-mono text-[11px] lg:text-sm text-teal-ink">{num(Math.round(FOUND * p), locale)} {t('frame.found')}</p>
            {ROWS.map((k, r) => (
              <div key={k} className={`flex items-center justify-between gap-2 rounded-xl border border-line bg-white px-2.5 py-1.5 ${ENTER} ${DELAY[r]} ${p >= 0.4 ? SHOWN : HIDDEN}`}>
                <span className="truncate text-[11px] lg:text-sm text-ink">{t(`frame.${k}`)}</span>
                <span className="shrink-0 font-mono text-[11px] lg:text-sm text-muted">{pricePer(PRICE[r], 'PER_DAY', locale)}</span>
              </div>
            ))}
          </>
        );
      }
      case 1:
        return (
          <>
            <div className="flex flex-wrap gap-1.5">
              {(['filterRegion', 'filterService'] as const).map((k, c) => (
                <span key={k} className={`rounded-full border px-2.5 py-1 font-mono text-[11px] lg:text-sm transition duration-200 ${p >= (c ? 0.45 : 0.2) ? 'border-teal bg-teal-soft text-teal-ink' : 'border-line bg-white text-muted'}`}>
                  {t(`frame.${k}`)}
                </span>
              ))}
            </div>
            <p className="font-mono text-[11px] lg:text-sm text-teal-ink">{num(Math.round(FOUND - (FOUND - HITS) * p), locale)} {t('frame.found')}</p>
            {/* Nuqtalar doim chizilgan turadi, faqat yonadi: opacity 0 da kutib turgan element yo'q */}
            <div className="relative aspect-[5/2] overflow-hidden rounded-xl border border-line bg-navy">
              {DOTS.map(([x, y], d) => (
                <span
                  key={d}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  className={`absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition duration-200 ${d < Math.round(HITS * p) ? 'bg-teal-lit' : 'bg-white/20'}`}
                />
              ))}
            </div>
          </>
        );
      case 2:
        return (
          <>
            {ROWS.slice(0, 2).map((k, r) => (
              <div key={k} className="flex items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-1.5">
                <span className={`h-3 w-3 shrink-0 rounded-[4px] border transition duration-200 ${p >= (r ? 0.3 : 0.15) ? 'border-teal bg-teal' : 'border-line bg-white'}`} />
                <span className="truncate text-[11px] lg:text-sm text-ink">{t(`frame.${k}`)}</span>
              </div>
            ))}
            <div className={`overflow-hidden rounded-xl border border-line bg-white ${ENTER} ${p >= 0.5 ? SHOWN : HIDDEN}`}>
              <div className="grid grid-cols-3 gap-2 border-b border-line px-2.5 py-1.5 font-mono text-[10px] lg:text-xs text-muted">
                <span aria-hidden="true" />
                <span className="truncate">{t('frame.colA')}</span>
                <span className="truncate">{t('frame.colB')}</span>
              </div>
              {/* Jadvalda birlik yozilmaydi (som, pricePer emas): telefonda ustun tor va "/ kun" matnni qirqardi */}
              {([
                ['price', som(PRICE[0], locale), som(PRICE[1], locale)],
                ['hours', t('frame.hoursA'), t('frame.hoursB')],
                ['ability', t('frame.abilityA'), t('frame.abilityB')],
              ] as const).map(([k, a, b]) => (
                <div key={k} className="grid grid-cols-3 items-baseline gap-2 border-b border-line px-2.5 py-1.5 text-[10px] lg:text-xs last:border-b-0">
                  <span className="truncate text-muted">{t(`frame.${k}`)}</span>
                  <span className="truncate font-mono text-ink">{a}</span>
                  <span className="truncate font-mono text-ink">{b}</span>
                </div>
              ))}
            </div>
          </>
        );
      case 3:
        return (
          <>
            <div className="rounded-xl border border-line bg-white p-2.5">
              <p className="truncate text-[11px] lg:text-sm font-semibold text-ink">{t('frame.row1')}</p>
              {/* Tugma va raqam bitta katakda almashadi: kadr balandligi o'zgarmaydi */}
              <span className="mt-2 grid">
                <span className={`col-start-1 row-start-1 rounded-full bg-teal px-2.5 py-1 text-center text-[11px] lg:text-sm font-semibold text-white transition duration-200 ease-in ${p >= 0.4 ? 'opacity-0' : 'opacity-100'}`}>
                  {t('frame.reveal')}
                </span>
                <span className={`col-start-1 row-start-1 self-center font-mono text-sm font-semibold lg:text-base text-navy ${ENTER} ${p >= 0.4 ? SHOWN : HIDDEN}`}>
                  {t('frame.phone')}
                </span>
              </span>
            </div>
            <p className={`font-mono text-[11px] lg:text-sm text-muted ${ENTER} delay-75 ${p >= 0.4 ? SHOWN : HIDDEN}`}>{t('frame.left', { n: LEFT })}</p>
          </>
        );
      default:
        return (
          <>
            <div className="space-y-1.5 rounded-xl border border-line bg-white p-2.5">
              {([['cargo', 'cargoValue'], ['date', 'dateValue']] as const).map(([k, v]) => (
                <span key={k} className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5 last:border-b-0 last:pb-0">
                  <span className="text-[10px] lg:text-xs text-muted">{t(`frame.${k}`)}</span>
                  <span className="truncate font-mono text-[11px] lg:text-sm text-ink">{t(`frame.${v}`)}</span>
                </span>
              ))}
              <span className="block rounded-full bg-teal px-2.5 py-1 text-center text-[11px] lg:text-sm font-semibold text-white">{t('frame.send')}</span>
            </div>
            <div className={`flex items-center gap-2 ${ENTER} ${p >= 0.45 ? SHOWN : HIDDEN}`}>
              <span className="rounded-full border border-teal/40 bg-teal-soft px-2.5 py-0.5 font-mono text-[11px] lg:text-sm font-semibold text-teal-ink">{t('frame.status')}</span>
              <span className="truncate text-[11px] lg:text-sm text-muted underline decoration-line">{t('frame.track')}</span>
            </div>
          </>
        );
    }
  };

  /*
   * lg:items-center: o'ng ustundagi besh tugma kadrdan ikki barobar baland, tepaga tekislansa
   * kadr ostida bo'sh joy qolardi. Kadrlar bitta katakda turgani uchun chap ustunning balandligi
   * eng baland kadr bo'yicha qotgan, ya'ni markazga tushirish sakrash keltirmaydi.
   */
  return (
    <div
      ref={root}
      onKeyDown={onKey}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onPointerCancel={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center"
    >
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="inline-block whitespace-nowrap rounded-full border border-amber/40 bg-amber-soft px-2.5 py-0.5 text-[11px] font-semibold text-amber-ink">{t('demo')}</span>
          {/*
            Harakat kamaytirilganda to'xtatish tugmasi ham, ostidagi maslahat ham keraksiz
            (taymer yurmaydi), lekin ular JS shartidan EMAS, CSS dan yashiriladi: reduced
            gidratsiyadan keyin bilinadi, ya'ni shart bilan yashirsak ikkovi ekranda bir
            ko'rinib keyin yo'qolardi. display:none tugmani tab tartibidan ham oladi.
          */}
          <button
            type="button"
            // data-explainer-hint: video sahifasi buni ham yashiradi, kadrda bosadigan odam yo'q
            data-explainer-hint
            onClick={() => setPaused((v) => !v)}
            className="rounded-full border border-line bg-white px-3 py-1 font-mono text-[11px] font-semibold text-ink/80 transition duration-200 motion-reduce:hidden hover:border-teal hover:text-teal-ink"
          >
            {paused ? t('play') : t('pause')}
          </button>
        </div>
        {/*
          Kadrlar HAR DOIM bitta katakda ustma-ust turadi, harakat kamaytirilgan bo'lsa ham.
          Balandlik eng baland kadr bo'yicha qotadi va server chizgan HTML gidratsiyadan keyingi
          birinchi kadr bilan bir xil bo'ladi, ya'ni bo'lim ochilishda sakramaydi. Kamaytirilgan
          rejimda faqat taymer o'chadi, qadamni o'ng ustundagi tugmalar almashtiradi.
        */}
        <div aria-hidden="true" className="grid">
          {STEPS.map((k, i) => (
            <div
              key={k}
              className={`col-start-1 row-start-1 transition ${i === step ? `duration-300 ease-(--ease-out-quart) ${SHOWN}` : `pointer-events-none duration-200 ease-in ${HIDDEN}`}`}
            >
              <div className={`rounded-card border bg-sand p-2.5 ${i === step ? 'border-teal/60' : 'border-line'}`}>
                <div className="flex items-center gap-2 px-0.5 pb-2">
                  <span className="font-mono text-[11px] lg:text-sm font-semibold text-teal-ink">0{i + 1}</span>
                  <span className="truncate text-[11px] lg:text-sm font-semibold text-ink/70">{t(`steps.${k}.title`)}</span>
                </div>
                <div className="space-y-2">{screen(i)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <ol className="space-y-2">
          {STEPS.map((k, i) => (
            <li key={k}>
              <button
                type="button"
                ref={(el) => { btns.current[i] = el; }}
                onClick={() => go(i)}
                aria-current={i === step ? 'step' : undefined}
                className={`w-full rounded-card border px-4 py-3 text-left transition duration-200 ease-(--ease-out-quart) ${i === step ? 'border-teal/60 bg-white' : 'border-line bg-white/60 hover:border-teal/40'}`}
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] font-semibold text-teal-ink">0{i + 1}</span>
                  <span className="font-display text-base font-bold text-navy">{t(`steps.${k}.title`)}</span>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">{t(`steps.${k}.body`)}</span>
              </button>
            </li>
          ))}
        </ol>
        {/* data-explainer-hint: video sahifasi shu eslatmani yashiradi, kadrda klaviatura yo'q */}
        <p data-explainer-hint className="mt-3 text-xs text-muted motion-reduce:hidden">{t('hint')}</p>
      </div>
    </div>
  );
}
