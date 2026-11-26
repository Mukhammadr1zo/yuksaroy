'use client';
// Qidiruv ro'yxatining davomi: server birinchi 20 qatorni chizadi, qolganini shu orol sahifa-sahifa yuklaydi.
// Sentinel ko'rinishga kirganda o'zi yuklaydi, 44 px tugma esa IntersectionObserver ishlamagan WebView uchun zaxira.
// Sanoq serverdagi qaror satri bilan bir xil: API total minus namunalar (demo), shuning uchun faqat namunasiz qatorlar sanaladi.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SearchLang } from '@yuksaroy/domain';
import { api } from '@/lib/api';
import type { Page, TerminalCard } from '@/lib/types';
import type { ListingCard, ListingPage } from '@/lib/types-listing';
import { haptic } from './TgProvider';
import { BTN_GHOST, Err, ListingRow, TerminalRow } from './bits';

const LIMIT = 20;
// Orqaga qaytganda yuklangan sahifalar va joy tiklansin: server faqat birinchi 20 qatorni qaytaradi.
// Faqat bitta qidiruv saqlanadi (boshqa qidiruv ochilsa eskisi o'chadi), hajm cheklangan.
const KEEP = 'tg-more', KEEP_Y = 'tg-more-y', MAX_KEEP = 200;
type Item = TerminalCard | ListingCard;
interface Kept { path: string; items: Item[]; page: number; done: boolean }
// Faqat tarix bo'yicha qaytganda (Orqaga) tiklanadi: shu qidiruv yangidan ochilsa eski qatorlar va eski joy chiqmasin
let traversed = false;
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { traversed = true; });
  // Bosish = yangi o'tish: boshqa sahifaga qaytishdan qolgan bayroq keyingi yangi ochilishda eski qatorlarni chiqarmasin
  window.addEventListener('click', () => { traversed = false; }, true);
}

export function MoreRows({ path, kind, lang, loaded, total, demo, shown }: {
  /** Birinchi sahifa so'ralgan aynan shu yo'l (filtrlar bilan, page va limitsiz). */
  path: string; kind: 'terminal' | 'listing'; lang: SearchLang;
  /** Serverda chizilgan qatorlar soni (namunalar bilan), API total, namunalar soni, namunasiz ko'rsatilgani. */
  loaded: number; total: number; demo: number; shown: number;
}) {
  const t = useTranslations('tg.search');
  const ts = useTranslations('tg.state');
  const tc = useTranslations('tg.common');
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(2);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // Qisqa yoki bo'sh sahifa = ro'yxat tugagan: total eskirgan bo'lsa ham cheksiz so'rov ketmaydi
  const [done, setDone] = useState(false);
  const [y, setY] = useState(0);
  const lock = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const count = loaded + items.length;
  const more = !done && count < total;
  const real = shown + items.filter((x) => !x.isDemo).length;

  const load = useCallback(async () => {
    // lock: kuzatuvchi va tugma bir vaqtda ishlasa bitta sahifa ikki marta so'ralmasin
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const d = await api<Page<TerminalCard> | ListingPage>(`${path}&page=${page}&limit=${LIMIT}`);
      setItems((prev) => [...prev, ...(d.items as Item[])]);
      setPage((p) => p + 1);
      if (d.items.length < LIMIT) setDone(true);
    } catch { setFailed(true); }
    lock.current = false;
    setBusy(false);
  }, [path, page]);

  // Bo'yashdan oldin tiklanadi (gidratsiyani buzmaslik uchun lazy useState emas), shunda brauzer joyni to'liq balandlikda tiklaydi
  useLayoutEffect(() => {
    try {
      const back = traversed;
      traversed = false;
      const k = JSON.parse(sessionStorage.getItem(KEEP) ?? 'null') as Kept | null;
      if (!back || !k || k.path !== path) { sessionStorage.removeItem(KEEP); sessionStorage.removeItem(KEEP_Y); return; }
      const [sy, sp] = (sessionStorage.getItem(KEEP_Y) ?? '').split('|');
      setItems(k.items); setPage(k.page); setDone(k.done);
      if (sp === path && Number(sy) > 0) setY(Number(sy));
    } catch { /* sessionStorage yopiq yoki buzuq: oddiy holat */ }
  }, [path]);
  // Qatorlar chizilgach joy qo'lda qo'yiladi: brauzer tiklashi qisqa hujjatda qisqarib qolgan bo'lishi mumkin
  useLayoutEffect(() => { if (y) window.scrollTo(0, y); }, [y]);
  useEffect(() => {
    if (!items.length) return; // tiklashdan oldingi bo'sh holat saqlangan qatorlarni bosib ketmasin
    try { if (items.length <= MAX_KEEP) sessionStorage.setItem(KEEP, JSON.stringify({ path, items, page, done } satisfies Kept)); } catch { /* joy yetmasa saqlanmaydi */ }
  }, [path, items, page, done]);
  useEffect(() => {
    // Joy: 0 yozilmaydi, chunki sahifadan chiqishda brauzer tepaga qaytaradi va saqlanganni bosib ketardi
    // Kadrga bir marta yoziladi: surish paytida har hodisada sessionStorage ga yozish ro'yxatni tortib qo'yardi
    let raf = 0;
    const save = () => { raf = 0; if (window.scrollY > 0) try { sessionStorage.setItem(KEEP_Y, `${Math.round(window.scrollY)}|${path}`); } catch { /* ruxsat yo'q */ } };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(save); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) window.cancelAnimationFrame(raf); };
  }, [path]);

  useEffect(() => {
    const el = end.current;
    // Xato bo'lsa o'zi qayta urinmaydi: qayta urinish tugmasi bosilganda
    if (!el || !more || failed || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) void load(); }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, failed, load, items.length]);

  return (
    <>
      {items.length ? (
        <div className="mt-2 space-y-2">
          {items.map((x) => (kind === 'terminal' ? <TerminalRow key={x.id} t={x as TerminalCard} lang={lang} /> : <ListingRow key={x.id} l={x as ListingCard} lang={lang} />))}
        </div>
      ) : null}
      <p className="mt-3 text-center font-mono text-xs text-muted tabular-nums">{t('more', { shown: real, total: total - demo })}</p>
      {failed ? <div className="mt-2"><Err>{t('moreFailed')}</Err></div> : null}
      {more ? (
        <div ref={end} className="mt-2">
          <button type="button" data-more disabled={busy} onClick={() => { haptic(); void load(); }} className={BTN_GHOST}>{busy ? tc('loading') : failed ? ts('retry') : t('loadMore')}</button>
        </div>
      ) : null}
    </>
  );
}
