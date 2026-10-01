'use client';
/**
 * Admin panelining umumiy qismlari. Panel bu o'qiladigan sahifa emas, ish quroli:
 * har ekran bir xil ko'rinadi, bir xil joyda filtr, bir xil joyda amal tugmasi.
 * Shuning uchun jadval, filtr paneli, yon varaq va tasdiq tugmasi shu yerda bir marta yozilgan.
 *
 * Ranglar loyihaning o'z tokenlari (navy, teal, sand, line, muted, ink); xavfli amal uchun
 * qizil sinflar, chunki loyihada qizil token yo'q va qolgan admin kodi ham shunday yozilgan.
 *
 * 3.0: ro'yxat ekranlari URL dan o'qiydi (useListQuery), jadval tartiblaydi, ustun yashiradi,
 * qator tanlaydi va klaviatura bilan yuradi (useRovingList). Hammasi ixtiyoriy prop: eski
 * chaqiruvlar (cols, rows, keyOf, empty, onRow) o'zgarishsiz ishlaydi.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { CaretDownIcon, CaretUpIcon, CheckIcon, DotsThreeIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { AdminContext } from './context';

export const INPUT = 'w-full rounded-xl border border-field bg-white px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-teal focus:ring-2 focus:ring-teal/25 disabled:bg-sand';
export const BTN = 'inline-flex items-center justify-center gap-1.5 rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-teal-ink active:scale-[0.98] disabled:bg-line disabled:text-muted disabled:cursor-not-allowed';
export const BTN_GHOST = 'inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy transition duration-150 hover:border-teal hover:text-teal-ink active:scale-[0.98] disabled:opacity-60';
export const BTN_DANGER = 'inline-flex items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition duration-150 hover:bg-red-50 active:scale-[0.98] disabled:opacity-60';
export const CARD = 'rounded-card border border-line bg-white';

/** Ommaviy amal va tanlovli eksport chegarasi: server BULK_TOO_MANY bilan shu sonni qaytaradi. */
export const BULK_MAX = 500;
/**
 * CSV chegarasi (server common/csv.ts bilan bir xil). Mijozda ham tekshiriladi: havola oddiy
 * <a download>, server 400 qaytarsa brauzer JSON matnini fayl qilib saqlaydi va ekranda xabar chiqmaydi.
 */
export const CSV_MAX = 5000;

/** Sahifa sarlavhasi: chapda nima, o'ngda shu ekranning asosiy amali. */
export function PageHead({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold text-navy">{title}</h1>
        {lead ? <p className="mt-1 text-sm text-muted">{lead}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

/** Filtr qatori: Enter bosilganda ham izlaydi, chunki qidiruvda odam tugmani bosmaydi. */
export function Toolbar({ onSubmit, children }: { onSubmit: () => void; children: React.ReactNode }) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className={`${CARD} mt-5 flex flex-wrap items-end gap-2 p-3`}
    >
      {children}
    </form>
  );
}

export function Labeled({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

export type SortDir = 'asc' | 'desc';

export type Col<T> = {
  key: string;
  head: string;
  /** Raqam, sana, id: mono va o'ngga tekislangan ustunlar taqqoslash uchun qulay. */
  num?: boolean;
  width?: string;
  cell: (row: T) => React.ReactNode;
  /** Server tartib maydoni (sort=...). Bo'lsa sarlavha tugmaga aylanadi. */
  sort?: string;
  /** Operator ustunni yashira oladimi. Sukut: birinchi ustundan boshqasi ha. */
  hideable?: boolean;
  /** Sukutda yashirin (masalan terminals da registryNo): "Sukut" tugmasi shu holatga qaytaradi. */
  hidden?: boolean;
};

/** Popover va RowMenu bandi. danger faqat rang: xavfli amalning o'zi sahifada ikki bosqichli. */
export type MenuItem = {
  label: string;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Berilsa band checkbox bo'ladi (Ustunlar menyusi) va bosilganda menyu yopilmaydi. */
  checked?: boolean;
};

/**
 * Amal kodini gapga aylantiradi: "listing.decide" o'rniga "E'lonni tasdiqladi".
 * Jurnal ham, bosh sahifadagi tasma ham shundan o'qiydi.
 *
 * Kalitda nuqta chiziqchaga almashadi, aks holda next-intl kodni ichma-ich obyekt deb
 * o'qirdi va "listing-decide" bir vaqtda ham satr, ham obyekt bo'lishi kerak bo'lardi.
 * Qaror amallarida natija tafsilotdagi `approve` dan olinadi: tasdiqlangan bilan rad
 * etilgan jurnalda bir xil ko'rinib turardi.
 * Kalit topilmasa kodning o'zi chiqadi: yangi amal qo'shilsa varaq yiqilmaydi.
 */
export function useActionText() {
  const ta = useTranslations('admin.audit');
  return (action: string, meta?: unknown) => {
    const base = `act.${action.replace(/\./g, '-')}`;
    const ok = meta && typeof meta === 'object' ? (meta as { approve?: unknown }).approve : undefined;
    const k = typeof ok === 'boolean' ? `${base}-${ok ? 'yes' : 'no'}` : base;
    return ta.has(k) ? ta(k) : ta.has(base) ? ta(base) : action;
  };
}

/**
 * Ro'yxat ichida klaviatura: j/k (yoki strelka) qator, Home/End, Enter/Space ochadi,
 * x tanlaydi, '.' qator menyusi. Jadval ham, bosh sahifadagi ish ro'yxati ham shu hookdan:
 * ikki joyda ikki xil klaviatura odati bo'lmasin.
 *
 * Fokus "roving tabIndex" bilan: faqat joriy qator Tab to'xtash joyi, qolganlari -1.
 * Fokus keydown ichida to'g'ridan-to'g'ri ko'chiriladi (effect emas): qator ichidagi
 * havolaga sichqoncha bilan kirilganda effect fokusni tortib olmasin.
 */
export function useRovingList(n: number, h: { onOpen: (i: number) => void; onSelect?: (i: number) => void; onMenu?: (i: number) => void }) {
  const [index, setIndex] = useState(0);
  const cur = Math.min(index, Math.max(0, n - 1));
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!n) return;
    const t = e.target as HTMLElement;
    const onContainer = t === e.currentTarget;
    // Katak ichidagi havola, tugma, katakcha yoki ochiq menyu o'z klaviaturasini o'zi biladi;
    // Enter ni ikki marta ishlatish qatorni ikki marta ochardi.
    if (!onContainer && t.closest('a,button,input,select,textarea,[contenteditable="true"],[role="menu"]')) return;
    let next: number;
    switch (e.key) {
      case 'j': case 'ArrowDown': next = onContainer ? cur : Math.min(n - 1, cur + 1); break;
      case 'k': case 'ArrowUp': next = onContainer ? cur : Math.max(0, cur - 1); break;
      case 'Home': next = 0; break;
      case 'End': next = n - 1; break;
      case 'Enter': case ' ': e.preventDefault(); h.onOpen(cur); return; // probel sahifani pastga surmasin
      case 'x': if (h.onSelect) { e.preventDefault(); h.onSelect(cur); } return;
      case '.': if (h.onMenu) { e.preventDefault(); h.onMenu(cur); } return;
      default: return;
    }
    e.preventDefault();
    setIndex(next);
    const el = e.currentTarget.querySelector<HTMLElement>(`[data-roving="${next}"]`);
    el?.focus();
    el?.scrollIntoView({ block: 'nearest' });
  };
  return {
    index: cur,
    setIndex,
    containerProps: { tabIndex: 0, onKeyDown },
    itemProps: (i: number) => ({ tabIndex: i === cur ? 0 : -1, 'data-roving': String(i) }),
  };
}

/**
 * Ochiladigan menyu: tugma + role="menu" panel. Tashqi bosish va Esc yopadi (UserMenu.tsx odati),
 * ochilganda fokus birinchi bandda, strelkalar aylanadi. Tez amallar, Ustunlar va RowMenu shu bitta
 * primitivdan: uch xil menyu uch xil klaviatura bilan bo'lmasin.
 */
export function Popover({ label, icon, items, align = 'right', className = BTN_GHOST, iconOnly = false, labelClass = '' }: {
  label: string; icon?: React.ReactNode; items: MenuItem[]; align?: 'left' | 'right'; className?: string;
  /** Faqat ikonka ko'rinadi, label aria-label bo'ladi (RowMenu). */
  iconOnly?: boolean;
  /** Label o'ramiga sinf: yuqori panelda telefonda matn yashiriladi ("hidden sm:inline"). */
  labelClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    // Panel fixed: sahifa yoki karta aylansa tugma ketadi, panel joyida qolib ketardi; shuning uchun yopiladi
    const hide = () => setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    document.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    panel.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc);
      document.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide);
    };
  }, [open]);

  /**
   * Panel fixed, koordinata tugmadan: DataTable kartasi xl gacha overflow-x-auto (jadval sahifani
   * yon tomonga surmasin), absolute panel u yerda kesilib qolar va oxirgi qatorlarda karta ichida
   * aylanardi. Drawer ning overflow-y-auto tanasida ham shu.
   */
  const toggle = () => {
    const r = btn.current?.getBoundingClientRect();
    if (r) {
      // ponytail: balandlik taxminiy (band ~37 px + hoshiya); ekran pastida joy bo'lmasa tepaga ochiladi,
      // aylantirib ko'rib bo'lmaydi, chunki aylantirish menyuni yopadi
      const up = r.bottom + 4 + items.length * 38 + 12 > window.innerHeight;
      setPos({
        ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
        ...(align === 'left' ? { left: r.left } : { right: document.documentElement.clientWidth - r.right }),
      });
    }
    setOpen(!open);
  };
  const close = (back: boolean) => { setOpen(false); if (back) btn.current?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    const list = Array.from(panel.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? []);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case 'ArrowDown': list[(i + 1) % list.length].focus(); break;
      case 'ArrowUp': list[(i - 1 + list.length) % list.length].focus(); break;
      case 'Home': list[0].focus(); break;
      case 'End': list[list.length - 1].focus(); break;
      // Esc bu yerda faqat menyuni yopsin: hujjat darajasidagi Drawer va BulkBar tinglovchilariga yetmasin
      case 'Escape': e.stopPropagation(); close(true); break;
      case 'Tab': close(false); return;
      default: return;
    }
    e.preventDefault();
  };

  const item = 'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-sand disabled:opacity-50';
  return (
    <div ref={box} className="relative inline-block">
      <button ref={btn} type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open}
        aria-label={iconOnly || labelClass ? label : undefined} title={iconOnly || labelClass ? label : undefined} className={className}>
        {icon}
        {iconOnly ? null : labelClass ? <span className={labelClass}>{label}</span> : label}
      </button>
      {open ? (
        <div ref={panel} role="menu" aria-label={label} onKeyDown={onKey} style={pos}
          className={`${CARD} fixed z-20 min-w-44 p-1.5 shadow-lg`}>
          {items.map((it, i) => {
            const cls = `${item} ${it.danger ? 'text-red-700' : 'text-ink'}`;
            if (it.href && !it.disabled) {
              return (
                <Link key={i} role="menuitem" href={it.href} className={cls} onClick={() => { it.onSelect?.(); close(false); }}>
                  {it.label}
                </Link>
              );
            }
            const check = it.checked !== undefined;
            return (
              <button key={i} type="button" role={check ? 'menuitemcheckbox' : 'menuitem'} aria-checked={check ? it.checked : undefined}
                disabled={it.disabled} className={cls}
                onClick={() => { it.onSelect?.(); if (!check) close(true); }}>
                {check ? <CheckIcon size={14} weight="bold" aria-hidden="true" className={it.checked ? 'text-teal-ink' : 'invisible'} /> : null}
                {it.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Qator oxiridagi "..." menyusi. Bosish qatorga yetmasin: aks holda menyu ochilishi bilan qator ham ochilardi. */
export function RowMenu({ items }: { items: MenuItem[] }) {
  const t = useTranslations('admin.table');
  return (
    <span data-rowmenu="1" onClick={(e) => e.stopPropagation()} className="inline-block">
      <Popover label={t('rowMenu')} iconOnly items={items} icon={<DotsThreeIcon size={18} weight="bold" aria-hidden="true" />}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-sand hover:text-navy" />
    </span>
  );
}

const COLS_KEY = 'ys-admin-cols:';

/**
 * Yashirilgan ustunlar: localStorage faqat qulaylik, xususiy rejimda otsa sukut ishlaydi.
 * O'qish effect ichida: server chizgan jadval bilan mijoz jadvali bir xil bo'lsin (hydration).
 * null = operator hech narsani o'zgartirmagan, ustunning o'z `hidden` bayrog'i amal qiladi.
 */
function useColumnPrefs(screen: string | undefined, defaults: string[]) {
  const [stored, setStored] = useState<string[] | null>(null);
  useEffect(() => {
    if (!screen) return;
    try {
      const v = localStorage.getItem(COLS_KEY + screen);
      setStored(v ? (JSON.parse(v) as string[]) : null);
    } catch { /* xususiy rejim */ }
  }, [screen]);
  const set = (next: string[] | null) => {
    setStored(next);
    if (!screen) return;
    try {
      if (next) localStorage.setItem(COLS_KEY + screen, JSON.stringify(next));
      else localStorage.removeItem(COLS_KEY + screen);
    } catch { /* xususiy rejim */ }
  };
  return { hidden: stored ?? defaults, set };
}

/** Sahifa katakchasi: "ba'zilari tanlangan" holatini faqat DOM xususiyati bilan chizish mumkin. */
function PageCheck({ all, some, label, onToggle }: { all: boolean; some: boolean; label: string; onToggle: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = some && !all; }, [some, all]);
  return <input ref={ref} type="checkbox" checked={all} onChange={onToggle} aria-label={label} className="h-4 w-4 accent-teal" />;
}

/**
 * Jadval. Admin ma'lumoti ustunlarga taqqoslanadi (qaysi biri eskiroq, qaysi biri kattaroq),
 * shuning uchun keng ekranda bu kartochka emas, haqiqiy jadval. Telefonda esa har qator
 * kartochkaga aylanadi: sahifaning o'zi ham, jadval ham hech qachon yon tomonga surilmaydi.
 *
 * Sarlavha yopishqoq (thead sticky): 30 qatorli ro'yxatda pastga tushganda qaysi ustun
 * nima ekani ko'rinib tursin. Overflow sticky ni buzadi, shuning uchun konteynerda overflow
 * faqat xl dan boshlab yo'q: nowrap sarlavha, Pill va sana ustunlari jadvalni ~980 px dan
 * pastga tushirmaydi, xl gacha u karta ichida aylanadi, aks holda butun sahifa yon tomonga
 * surilardi (768 va 1024 px da o'lchangan). Keraksiz ustunni operator Ustunlar menyusidan yashiradi.
 */
export function DataTable<T>({ cols, rows, keyOf, empty, onRow, loading, sort, onSort, screen, select, href, rowMenu, onReset }: {
  cols: Col<T>[]; rows: T[]; keyOf: (row: T) => string; empty: string; onRow?: (row: T) => void;
  /** Bo'sh holatda "Filtrni tozalash" tugmasi: filtr bilan hech narsa topilmasa chiqish yo'li ko'rinib tursin. */
  onReset?: () => void;
  /** rows bo'sh bo'lsa skelet, bor bo'lsa xira: eski ro'yxat ko'rinib turadi, sakramaydi. */
  loading?: boolean;
  sort?: { field: string; dir: SortDir };
  onSort?: (field: string, dir: SortDir) => void;
  /** Berilsa Ustunlar menyusi chiqadi va tanlov localStorage 'ys-admin-cols:<screen>' da turadi. */
  screen?: string;
  /** Tanlov sahifalar aro saqlanadi (ekran holati), jadval faqat chizadi va o'zgartiradi. */
  select?: { ids: Set<string>; onChange: (ids: Set<string>) => void };
  /** Qator havola: birinchi katakda haqiqiy Link (o'rta tugma yangi oynada), qolgan kataklar push. onRow bilan birga berilmaydi. */
  href?: (row: T) => string;
  rowMenu?: (row: T) => MenuItem[];
}) {
  const t = useTranslations('admin.table');
  const router = useRouter();
  const tableRef = useRef<HTMLTableElement>(null);
  const shift = useRef(false);
  const lastPick = useRef<number | null>(null);

  const prefs = useColumnPrefs(screen, useMemo(() => cols.filter((c) => c.hidden).map((c) => c.key), [cols]));
  const hideable = cols.filter((c, i) => c.hideable ?? i > 0);
  const shown = screen ? cols.filter((c) => !prefs.hidden.includes(c.key)) : cols;

  const openRow = (r: T) => { if (href) router.push(href(r)); else onRow?.(r); };
  const interactive = !!(href || onRow);
  const roving = !!(interactive || select || rowMenu);

  /** Bir qatorni almashtiradi; Shift bilan oxirgi bosilgan qatordan shu qatorgacha oraliq. */
  const toggle = (i: number, range: boolean) => {
    if (!select) return;
    const ids = new Set(select.ids);
    const on = !ids.has(keyOf(rows[i]));
    const from = range && lastPick.current !== null ? Math.min(lastPick.current, i) : i;
    const to = range && lastPick.current !== null ? Math.max(lastPick.current, i) : i;
    for (let k = from; k <= to; k++) { const id = keyOf(rows[k]); if (on) ids.add(id); else ids.delete(id); }
    lastPick.current = i;
    select.onChange(ids);
  };
  const togglePage = () => {
    if (!select) return;
    const ids = new Set(select.ids);
    const all = rows.every((r) => ids.has(keyOf(r)));
    for (const r of rows) { if (all) ids.delete(keyOf(r)); else ids.add(keyOf(r)); }
    select.onChange(ids);
  };

  const rov = useRovingList(rows.length, {
    onOpen: (i) => openRow(rows[i]),
    onSelect: select ? (i) => toggle(i, false) : undefined,
    // '.' menyuni DOM orqali ochadi: har qator uchun alohida holat saqlashdan arzon
    onMenu: rowMenu ? (i) => tableRef.current?.querySelector<HTMLElement>(`[data-roving="${i}"] [data-rowmenu] button`)?.click() : undefined,
  });
  // Sahifa yoki filtr almashganda fokus birinchi qatorga: eski indeks yangi ro'yxatda hech nimani anglatmaydi
  const { setIndex } = rov;
  useEffect(() => { setIndex(0); lastPick.current = null; }, [rows, setIndex]);

  if (!rows.length && loading) {
    return (
      <div className={`${CARD} mt-4 px-4 py-5`} aria-busy="true" aria-label={t('loadingRows')}>
        <Skeleton rows={8} />
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className={`${CARD} mt-4 border-dashed px-6 py-12 text-center text-sm text-muted`}>
        <p>{empty}</p>
        {onReset ? <button type="button" onClick={onReset} className={`${BTN_GHOST} mt-3`}>{t('clearFilters')}</button> : null}
      </div>
    );
  }

  const th = 'whitespace-nowrap px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted';
  const pageAll = !!select && rows.every((r) => select.ids.has(keyOf(r)));
  const pageSome = !!select && rows.some((r) => select.ids.has(keyOf(r)));

  return (
    <div className="mt-4">
      {screen && hideable.length ? (
        <div className="mb-2 flex justify-end">
          <Popover label={t('columns')} className={`${BTN_GHOST} px-3 py-1.5 text-xs`} items={[
            ...hideable.map((c) => ({
              label: c.head,
              checked: !prefs.hidden.includes(c.key),
              onSelect: () => prefs.set(prefs.hidden.includes(c.key) ? prefs.hidden.filter((k) => k !== c.key) : [...prefs.hidden, c.key]),
            })),
            { label: t('columnsReset'), onSelect: () => prefs.set(null) },
          ]} />
        </div>
      ) : null}
      <div className={`${CARD} sm:overflow-x-auto xl:overflow-visible ${loading ? 'opacity-60' : ''}`} aria-busy={loading || undefined}>
        {/*
          Telefonda jadval jadval bo'lib qolmaydi: har qator kartochkaga aylanadi va
          ustun sarlavhasi katakning chap tomonida turadi. Bo'sh katak mobil ko'rinishda
          umuman chiqmaydi, aks holda sarlavha yonida hech nima turmasdi.
        */}
        <table ref={tableRef} className="block w-full text-sm sm:table" {...(roving ? rov.containerProps : {})}>
          {/* top: --admin-top ni B beradi (globals.css); yo'q bo'lsa topbar balandligi 52px */}
          <thead className="hidden bg-sand text-left sm:sticky sm:top-[var(--admin-top,52px)] sm:z-10 sm:table-header-group">
            <tr>
              {select ? (
                <th scope="col" className={`${th} w-8`}>
                  <PageCheck all={pageAll} some={pageSome} label={t('selectPage')} onToggle={togglePage} />
                </th>
              ) : null}
              {shown.map((c) => {
                const active = !!(sort && c.sort && sort.field === c.sort);
                return (
                  <th key={c.key} scope="col" style={c.width ? { width: c.width } : undefined}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`${th} ${c.num ? 'text-right' : ''}`}>
                    {c.sort && onSort ? (
                      <button type="button" title={t('sortAria')}
                        onClick={() => onSort(c.sort!, active && sort!.dir === 'asc' ? 'desc' : 'asc')}
                        className={`inline-flex items-center gap-1 uppercase hover:text-navy ${active ? 'text-navy' : ''}`}>
                        {c.head}
                        {active ? (sort!.dir === 'asc' ? <CaretUpIcon size={12} weight="bold" aria-hidden="true" /> : <CaretDownIcon size={12} weight="bold" aria-hidden="true" />) : null}
                      </button>
                    ) : c.head}
                  </th>
                );
              })}
              {rowMenu ? <th scope="col" className={`${th} w-10`}><span className="sr-only">{t('rowMenu')}</span></th> : null}
            </tr>
          </thead>
          <tbody className="block sm:table-row-group">
            {rows.map((r, i) => {
              const id = keyOf(r);
              return (
                /*
                 * Qator klaviatura bilan ham ochiladi (useRovingList): faqat joriy qator Tab
                 * to'xtash joyi. role qo'yilmadi: role="button" jadval semantikasini buzadi va
                 * ekran o'qiydigan dastur qatorni qator deb aytmay qo'yadi; havola birinchi katakda.
                 */
                <tr key={id}
                  {...(roving ? rov.itemProps(i) : {})}
                  onFocus={roving ? () => rov.setIndex(i) : undefined}
                  onClick={interactive ? (e) => {
                    // Katakdagi havola, tugma yoki katakcha o'zi ishlaydi; qator ustiga yana bir marta ochilmasin
                    if ((e.target as HTMLElement).closest('a,button,input,label')) return;
                    openRow(r);
                  } : undefined}
                  className={`block border-t border-line/70 px-3 py-3 sm:table-row sm:p-0 ${interactive ? 'cursor-pointer hover:bg-sand/60' : ''} ${roving ? 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal' : ''} ${select?.ids.has(id) ? 'bg-teal-soft/40' : ''}`}>
                  {select ? (
                    <td data-label={t('selectRow')} className="flex items-center justify-between gap-3 py-0.5 before:font-mono before:text-[11px] before:font-semibold before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] sm:table-cell sm:px-3 sm:py-2 sm:align-top sm:before:content-none">
                      <input type="checkbox" checked={select.ids.has(id)} aria-label={t('selectRow')} className="h-4 w-4 accent-teal"
                        onClick={(e) => { shift.current = e.shiftKey; }} onChange={() => toggle(i, shift.current)} />
                    </td>
                  ) : null}
                  {/* Raqam va sana hech qachon sinmaydi: "3-" / "sentabr" ikki qatorga bo'linib o'qilmas edi */}
                  {shown.map((c, ci) => (
                    <td key={c.key} data-label={c.head}
                      /* min-w-0 (mobil karta) va sm:max-w-[22rem] (jadval): bitta uzun qiymat,
                         masalan 70 belgili tashkilot nomi, ustunni cheksiz kengaytirib butun
                         sahifani yon tomonga surib yuborardi. Chegara bilan matn o'raladi yoki
                         kesiladi, jadval esa ekranda qoladi. */
                      className={`flex min-w-0 items-baseline justify-between gap-3 py-0.5 empty:hidden before:shrink-0 before:font-mono before:text-[11px] before:font-semibold before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] sm:table-cell sm:max-w-[22rem] sm:px-3 sm:py-2 sm:align-top sm:empty:table-cell sm:before:content-none ${c.num ? 'font-mono tabular-nums sm:whitespace-nowrap sm:text-right' : ''}`}>
                      {href && ci === 0 ? <Link href={href(r)} className="text-inherit">{c.cell(r)}</Link> : c.cell(r)}
                    </td>
                  ))}
                  {rowMenu ? (
                    <td className="flex justify-end py-0.5 sm:table-cell sm:px-2 sm:py-1.5 sm:text-right sm:align-top">
                      <RowMenu items={rowMenu(r)} />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Sahifalagich: oldinga va orqaga, ustiga birinchi/oxirgi va raqam bilan o'tish.
 *
 * Nega: terminal reestri ~1716 qator va sahifada 30 tadan, ya'ni oxirgi sahifaga yetish
 * uchun "keyingi" ni 57 marta bosish kerak edi. Sahifa hajmi bu yerda o'zgartirilmaydi:
 * u har ekranning o'z holatida turadi va uni ko'chirish sakkizta ekranni qayta yozishni
 * talab qilardi. Oxirgi sahifaga yetishning o'zi asosiy og'riq edi.
 */
export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const t = useTranslations('pagination');
  const [jump, setJump] = useState('');
  if (pages <= 1) return null;
  const go = () => {
    const n = Number.parseInt(jump, 10);
    if (Number.isFinite(n)) onPage(Math.min(pages, Math.max(1, n)));
    setJump('');
  };
  return (
    <nav aria-label={t('aria')} className="mt-4 flex flex-wrap items-center justify-center gap-2 font-mono text-sm">
      <button type="button" disabled={page <= 1} onClick={() => onPage(1)} className={BTN_GHOST}>{t('first')}</button>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={BTN_GHOST}>{t('prev')}</button>
      <span className="px-2 tabular-nums text-muted">{page} / {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={BTN_GHOST}>{t('next')}</button>
      <button type="button" disabled={page >= pages} onClick={() => onPage(pages)} className={BTN_GHOST}>{t('last')}</button>
      <label className="ml-1 flex items-center gap-1.5 text-xs text-muted">
        <span>{t('goTo')}</span>
        <input
          type="number" min={1} max={pages} value={jump} inputMode="numeric"
          onChange={(e) => setJump(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } }}
          onBlur={() => jump && go()}
          className="w-16 rounded-lg border border-field bg-white px-2 py-1 text-center font-mono text-sm text-navy outline-none focus:border-teal"
        />
      </label>
    </nav>
  );
}

/**
 * Qatordan uning jurnaliga o'tish havolasi.
 *
 * Audit sahifasi ?entity= va ?entityId= ni qabul qilish uchun yozilgan edi, lekin hech
 * qayerdan havola yo'q edi: "buni kim tasdiqlagan" savoliga javob qo'lda varaqlab
 * qidirilardi.
 */
export function AuditLink({ entity, id }: { entity: string; id: string }) {
  const t = useTranslations('admin.common');
  return (
    <Link href={`/admin/audit?entity=${entity}&entityId=${id}`} className="text-xs font-semibold text-teal-ink hover:underline">
      {t('history')}
    </Link>
  );
}

/**
 * Holat yorlig'i. `truncate` (whitespace-nowrap emas): uzun matn bir qatorda qoladi, lekin
 * konteynerdan oshsa uch nuqta bilan kesiladi.
 *
 * Nega: yorliq ichida tashkilot nomi ham bo'ladi va u 70 belgigacha chiqadi. nowrap bilan u
 * jadval katagini cho'zar, katak sahifani cho'zar va butun sahifa yon tomonga surilardi
 * (foydalanuvchilar ro'yxati 1280 px da ham). truncate esa overflow:hidden beradi, shuning
 * uchun eng kichik kenglik nolga tushadi va yorliq hech qachon sahifani cho'zmaydi.
 * To'liq matn title da: kesilgani sichqoncha ostida o'qiladi.
 */
export function Pill({ tone = 'neutral', children }: { tone?: 'ok' | 'warn' | 'bad' | 'neutral'; children: React.ReactNode }) {
  const c = tone === 'ok' ? 'bg-teal-soft text-teal-ink' : tone === 'warn' ? 'bg-amber-soft text-amber-ink' : tone === 'bad' ? 'bg-red-50 text-red-700' : 'bg-sand text-muted';
  return (
    <span title={typeof children === 'string' ? children : undefined}
      className={`inline-block max-w-full truncate align-middle rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>
      {children}
    </span>
  );
}

/** Ro'yxat yuklanmadi: xato matni va "Qayta urinish". To'qqiz ekranda bir xil, shuning uchun kitda. */
export function LoadError({ err, onRetry }: { err: unknown; onRetry: () => void }) {
  const t = useTranslations('admin');
  return (
    <Notice tone="err">
      {errText(err, t, t.has, t('common.loadFailed'))}
      <button type="button" onClick={onRetry} className="ml-3 font-semibold underline">{t('table.retry')}</button>
    </Notice>
  );
}

export function Notice({ tone, children }: { tone: 'ok' | 'warn' | 'err'; children: React.ReactNode }) {
  return (
    <p role={tone === 'err' ? 'alert' : 'status'}
      className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${tone === 'err' ? 'bg-red-50 text-red-700' : tone === 'warn' ? 'bg-amber-soft text-amber-ink' : 'bg-teal-soft text-teal-ink'}`}>
      {children}
    </p>
  );
}

/**
 * Ikki bosqichli xavfli amal. Modal emas: bitta bosishda o'chib ketmasin degan maqsad uchun
 * modal ortiqcha, tugmaning o'zi "ishonchingiz komilmi" holatiga o'tadi va 4 soniyada qaytadi.
 */
export function ConfirmButton({ label, confirm, onRun, className = BTN_DANGER, disabled = false }: {
  label: string; confirm: string; onRun: () => Promise<void> | void; className?: string; disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // Shart bajarilmagan bo'lsa (masalan sabab yozilmagan) tugma o'chiq turadi va
  // tayyorlangan holat ham bekor qilinadi, aks holda "tasdiqlang" holatida qotib qolardi.
  useEffect(() => { if (disabled) setArmed(false); }, [disabled]);
  return (
    <button type="button" disabled={busy || disabled}
      className={armed ? `${className} border-red-400 bg-red-600 text-white hover:bg-red-700` : className}
      onClick={async () => {
        if (!armed) {
          setArmed(true);
          // 4 sekund kam edi: tasdiq oldidan nima yo'qolishi haqidagi ogohlantirishni
          // o'qib chiqqan operator qaytadan birinchi bosishdan boshlashga majbur bo'lardi
          // va tugma "ishlamayapti" deb ko'rinardi
          timer.current = setTimeout(() => setArmed(false), 10_000);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        setBusy(true);
        try { await onRun(); } finally { setBusy(false); setArmed(false); }
      }}>
      {armed ? confirm : label}
    </button>
  );
}

/**
 * Ommaviy amal paneli: tanlov bo'lsa pastda qotib turadi, Esc tanlovni bekor qiladi.
 * Sabab kataki va xavfli tugma (ConfirmButton) children sifatida ekrandan keladi:
 * har ekranning amali har xil, panel esa bitta.
 */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: React.ReactNode }) {
  const t = useTranslations('admin.table');
  useEffect(() => {
    if (!count) return;
    // Ochiq varaq (dialog) Esc ni o'zi oladi: varaqni yopish tanlovni ham tozalab yubormasin
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) onClear(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [count, onClear]);
  if (!count) return null;
  return (
    <div role="region" aria-live="polite" aria-label={t('selected', { n: count })}
      className="fixed inset-x-0 bottom-0 z-40 bg-navy text-white shadow-2xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span className="font-mono text-sm font-semibold tabular-nums">{t('selected', { n: count })}</span>
        <button type="button" onClick={onClear} className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold hover:bg-white/10">
          {t('clear')}
        </button>
        {count > BULK_MAX ? <span className="text-xs text-amber-soft">{t('bulkTooMany')}</span> : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}

/**
 * CSV yuklab olish havolasi: oddiy <a download>, cookie same-origin ketadi (Next rewrite /api/v1).
 * Tanlov bo'lsa faqat tanlangan qatorlar (ids), aks holda joriy filtr va tartib.
 * Shaxsiy ma'lumotli ro'yxat (users) faqat egaga: operatorga tugma umuman chizilmaydi.
 */
export function ExportLink({ path, filters, total, ids, ownerOnly }: {
  path: string; filters: Record<string, string | number | undefined>; total: number; ids?: Set<string>; ownerOnly?: boolean;
}) {
  const t = useTranslations('admin.table');
  // useContext to'g'ridan-to'g'ri: qobiqsiz chizilsa (masalan test) otmasin, shunchaki ega emas deb hisoblasin
  const isOwner = useContext(AdminContext)?.isOwner ?? false;
  if (ownerOnly && !isOwner) return null;
  const n = ids?.size ? ids.size : total;
  if (!n) return null;
  // Chegaradan oshsa tugma emas, izoh: server 400 ni brauzer fayl qilib saqlardi, operator sababini ko'rmasdi
  if (n > CSV_MAX) return <span className="text-[11px] text-muted">{t('exportTooMany', { max: CSV_MAX })}</span>;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (k === 'page' || k === 'limit' || v === undefined || v === '' || v === null) continue;
    q.set(k, String(v));
  }
  if (ids?.size) q.set('ids', Array.from(ids).slice(0, BULK_MAX).join(','));
  q.set('format', 'csv');
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <a href={`/api/v1${path}?${q}`} download className={BTN_GHOST}>
        <DownloadSimpleIcon size={16} aria-hidden="true" />
        {t('export', { n })}
      </a>
      <span className="text-[11px] text-muted">{t(ownerOnly ? 'exportOwnerOnly' : 'exportHint')}</span>
    </span>
  );
}

/** Yuklanish o'rni: matn o'rniga bo'sh chiziqlar, joy sakramaydi. Harakat reduce rejimida globals.css o'chiradi. */
export function Skeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  const widths = [92, 70, 84, 60];
  return (
    <div aria-hidden="true" className={`space-y-2.5 ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-3 animate-pulse rounded bg-line/60" style={{ width: `${widths[i % widths.length]}%` }} />
      ))}
    </div>
  );
}

/**
 * Yon varaq: uzun tahrir formasi uchun. Markazdagi modal uzun formada ekranga sig'maydi
 * va orqadagi ro'yxatni butunlay yopadi; yon varaqda esa qaysi qatorni tahrir qilayotganing ko'rinib turadi.
 * side='left' mobil menyu uchun: menyu tugmasi chapda, varaq ham chapdan chiqsin.
 */
export function Drawer({ open, title, onClose, children, footer, side = 'right' }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; side?: 'left' | 'right';
}) {
  const ta = useTranslations('a11y');
  const ref = useRef<HTMLDivElement>(null);
  /*
   * Varaq ochilishidan oldin fokus qayerda edi. Ref da, holatda emas: effekt faqat [open] ga
   * bog'liq va uni qayta yurgizish fokusni inputdan tortib olardi.
   */
  const prevFocus = useRef<HTMLElement | null>(null);
  /*
   * onClose ref orqali: chaqiruvchilar uni har renderda yangi funksiya qilib beradi
   * (onClose={() => setSheet(null)}). U effekt bog'liqligida turganida har harf
   * yozilganda (holat o'zgaradi, render bo'ladi) effekt qayta yurib fokusni varaqning
   * o'ziga olib qo'yardi: odam har harfdan keyin inputga qayta bosishga majbur edi.
   * Endi effekt faqat ochilish/yopilishda yuradi, fokus faqat ochilganda kiradi.
   */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    // Ochilganda fokus varaq ichiga kirsin, aks holda Tab orqadagi ro'yxatni aylanib chiqadi
    ref.current?.focus();
    // Tozalash faqat yopilganda va komponent ketganda yuradi (bog'liqlik faqat [open]):
    // shunda fokus varaqni ochgan tugmaga qaytadi. Aks holda klaviatura bilan yurgan odam
    // varaqni yopgach sahifaning boshiga tushib, o'sha qatorni qaytadan qidirishga majbur bo'lardi.
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocus.current?.focus();
      prevFocus.current = null;
    };
  }, [open]);
  // Tab varaq ichida aylanadi: aria-modal buni va'da qiladi; aks holda fokus orqadagi ro'yxat va
  // menyuga chiqib ketar, klaviaturali operator varaq ostidagi tugmani ko'rmasdan bosardi
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const els = Array.from(ref.current.querySelectorAll<HTMLElement>('input,select,textarea,button:not(:disabled),a[href]'));
    const first = els[0]; const last = els[els.length - 1];
    if (!first || !last) return;
    // Ochilganda fokus varaqning o'zida: shift+Tab u yerdan ham oxirgisiga
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  if (!open) return null;
  return (
    <div className={`fixed inset-0 z-50 flex ${side === 'left' ? 'justify-start' : 'justify-end'}`}>
      <div className="absolute inset-0 bg-navy/25" onClick={onClose} aria-hidden="true" />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onKeyDown={trap}
        className="relative flex h-full w-full max-w-xl flex-col bg-sand shadow-2xl outline-none">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-3">
          <h2 className="truncate font-display text-lg font-bold text-navy">{title}</h2>
          {/* Nomi "Yopish": ekran o'quvchi aria-label ni ovoz chiqarib o'qiydi va "X" "iks" bo'lib eshitilardi */}
          <button type="button" onClick={onClose} aria-label={ta('close')} className="rounded-full px-2 py-1 text-xl leading-none text-muted hover:bg-sand hover:text-navy">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/**
 * Xato kodini o'qiladigan matnga aylantiradi.
 *
 * Tarjimasi bo'lmasa kod va HTTP holati ko'rsatiladi. Ilgari bunday holatda faqat
 * "Ma'lumot yuklanmadi" chiqardi va serverga kirmasdan sababini bilib bo'lmasdi:
 * panelni ishlatadigan odam esa odatda serverga kira olmaydi.
 */
// `t` faqat kalit bilan chaqiriladi: tor imzo next-intl tarjimoniga strukturaviy mos keladi
export function errText(e: unknown, t: (k: string) => string, has: (k: string) => boolean, fallback: string) {
  if (!(e instanceof ApiError)) return fallback;
  const body = e.body as Record<string, unknown> | undefined;
  const code = typeof body?.code === 'string' ? body.code : undefined;
  // Server qaysi maydon aybdor ekanini aytsa, u ham ko'rsatiladi: uchta sozlamani
  // birga saqlaganda "Qiymat noto'g'ri" qaysi biri haqida ekani ma'lum bo'lmasdi.
  const where = typeof body?.key === 'string' ? body.key : typeof body?.field === 'string' ? body.field : undefined;
  // Server to'sayotgan sabablarni sanoq bilan qaytaradi (masalan tashkilotda nechta
  // terminal va buyurtma borligi). Ilgari bular tashlanardi va operator "tashkilotda
  // obyekt bor" degan xabarni ko'rib, qaysi ekanini topa olmasdi.
  const counts = Object.entries(body ?? {})
    .filter(([k, v]) => typeof v === 'number' && v > 0 && k !== 'statusCode')
    .map(([k, v]) => `${k}: ${v}`);
  const tail = where ? `: ${where}` : counts.length ? ` (${counts.join(', ')})` : '';
  if (code && has(`err.${code}`)) return `${t(`err.${code}`)}${tail}`;
  return `${fallback} (${code ?? 'HTTP'} ${e.status})${tail}`;
}

export type Paged<T> = { items: T[]; total: number; page: number; limit: number };

/**
 * Ro'yxatli ekranlarning umumiy holati: filtrlar, sahifa, yuklanish, qayta yuklash.
 * Har ekranda shuni qaytadan yozish o'rniga bitta hook. `path` filtrlarni o'zi qo'shadi.
 */
export function useAdminList<T>(path: string, filters: Record<string, string | number | undefined>, deps: unknown[] = []) {
  const [data, setData] = useState<Paged<T> | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== '' && v !== null) q.set(k, String(v));
  const url = `${path}${q.toString() ? `?${q}` : ''}`;

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    return api<Paged<T>>(url)
      .then(setData)
      .catch((e) => { setErr(e); setData({ items: [], total: 0, page: 1, limit: 30 }); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => { void load(); }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  return { data, pages, loading, err, reload: load };
}

/**
 * Ro'yxat filtrlari URL da: orqaga tugmasi filtrni qaytaradi, havola ulashiladi, useState nusxasi yo'q.
 * Sukutga teng qiymat URL ga yozilmaydi (toza manzil). Filtr yoki tartib o'zgarsa push va page=1
 * (patch da page bo'lmasa); faqat sahifa o'zgarsa replace: har varaqlash tarix yozuvi bo'lmasin.
 * Kirish kataklari draft bo'lib turadi va Enter/Qo'llash da set() chaqiradi (har harfda so'rov ketmasin).
 */
export function useListQuery<F extends Record<string, string | number>>(defaults: F) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Ekranlar literal obyekt uzatadi; bir marta muhrlanadi, aks holda har renderda yangi f
  const d = useRef(defaults).current;

  const f = useMemo(() => {
    const out: Record<string, string | number> = { ...d };
    for (const k of Object.keys(d)) {
      const v = sp.get(k);
      if (v === null) continue;
      if (typeof d[k] === 'number') { const n = Number(v); if (v !== '' && Number.isFinite(n)) out[k] = n; }
      else out[k] = v;
    }
    return out as F;
  }, [sp, d]);

  const set = useCallback((patch: Partial<F>, mode?: 'push' | 'replace') => {
    const keys = Object.keys(patch);
    const pageOnly = keys.length > 0 && keys.every((k) => k === 'page');
    const next: Record<string, string | number> = { ...f, ...patch };
    if (!pageOnly && !('page' in patch) && 'page' in d) next.page = d.page;
    const q = new URLSearchParams();
    // Begona parametrlar (masalan market dagi ?tab=) saqlanadi: bir sahifada ikki hook bo'lsa
    // biri ikkinchisining kalitini o'chirib yubormasin
    for (const [k, v] of sp) if (!(k in d)) q.set(k, v);
    for (const k of Object.keys(d)) if (String(next[k]) !== String(d[k])) q.set(k, String(next[k]));
    const href = q.toString() ? `${pathname}?${q}` : pathname;
    if ((mode ?? (pageOnly ? 'replace' : 'push')) === 'replace') router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [f, d, sp, pathname, router]);

  const reset = useCallback(() => router.push(pathname, { scroll: false }), [pathname, router]);

  return { f, set, reset };
}
