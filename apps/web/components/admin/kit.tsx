'use client';
/**
 * Admin panelining umumiy qismlari. Panel bu o'qiladigan sahifa emas, ish quroli:
 * har ekran bir xil ko'rinadi, bir xil joyda filtr, bir xil joyda amal tugmasi.
 * Shuning uchun jadval, filtr paneli, yon varaq va tasdiq tugmasi shu yerda bir marta yozilgan.
 *
 * Ranglar loyihaning o'z tokenlari (navy, teal, sand, line, muted, ink); xavfli amal uchun
 * qizil sinflar, chunki loyihada qizil token yo'q va qolgan admin kodi ham shunday yozilgan.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';

export const INPUT = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-teal focus:ring-2 focus:ring-teal/25 disabled:bg-sand';
export const BTN = 'inline-flex items-center justify-center gap-1.5 rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-teal-ink active:scale-[0.98] disabled:opacity-60';
export const BTN_GHOST = 'inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy transition duration-150 hover:border-teal hover:text-teal-ink active:scale-[0.98] disabled:opacity-60';
export const BTN_DANGER = 'inline-flex items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition duration-150 hover:bg-red-50 active:scale-[0.98] disabled:opacity-60';
export const CARD = 'rounded-card border border-line bg-white';

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

export type Col<T> = {
  key: string;
  head: string;
  /** Raqam, sana, id: mono va o'ngga tekislangan ustunlar taqqoslash uchun qulay. */
  num?: boolean;
  width?: string;
  cell: (row: T) => React.ReactNode;
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
 * Jadval. Admin ma'lumoti ustunlarga taqqoslanadi (qaysi biri eskiroq, qaysi biri kattaroq),
 * shuning uchun keng ekranda bu kartochka emas, haqiqiy jadval. Telefonda esa har qator
 * kartochkaga aylanadi: sahifaning o'zi ham, jadval ham hech qachon yon tomonga surilmaydi.
 */
export function DataTable<T>({ cols, rows, keyOf, empty, onRow }: {
  cols: Col<T>[]; rows: T[]; keyOf: (row: T) => string; empty: string; onRow?: (row: T) => void;
}) {
  if (!rows.length) return <div className={`${CARD} mt-4 border-dashed px-6 py-12 text-center text-sm text-muted`}>{empty}</div>;
  return (
    <div className={`${CARD} mt-4 sm:overflow-x-auto`}>
      {/*
        Telefonda jadval jadval bo'lib qolmaydi: har qator kartochkaga aylanadi va
        ustun sarlavhasi katakning chap tomonida turadi. Ilgari jadval 640px dan tor
        bo'lmasdi, ya'ni telefonda amal tugmasiga yetish uchun har safar yon tomonga
        surish kerak edi. Bo'sh katak mobil ko'rinishda umuman chiqmaydi, aks holda
        sarlavha yonida hech nima turmasdi.
      */}
      <table className="block w-full text-sm sm:table sm:min-w-[640px]">
        <thead className="hidden bg-sand text-left sm:table-header-group">
          <tr>
            {cols.map((c) => (
              <th key={c.key} scope="col" style={c.width ? { width: c.width } : undefined}
                className={`whitespace-nowrap px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted ${c.num ? 'text-right' : ''}`}>
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block sm:table-row-group">
          {rows.map((r) => (
            /*
             * Qator klaviatura bilan ham ochiladi. Ilgari yon varaqqa kirishning yagona
             * yo'li sichqoncha edi: yettita ekranda klaviatura bilan ishlaydigan operator
             * birorta yozuvni ocha olmasdi.
             *
             * role qo'yilmadi: role="button" jadval semantikasini buzadi va ekran
             * o'qiydigan dastur qatorni qator deb aytmay qo'yadi. To'liq to'g'ri yechim
             * birinchi katakning ichiga haqiqiy tugma qo'yish, u esa har ekranning
             * ustunlarini qayta yozishni talab qiladi.
             */
            <tr key={keyOf(r)} onClick={onRow ? () => onRow(r) : undefined}
              {...(onRow ? {
                tabIndex: 0,
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault(); // probel sahifani pastga surmasin
                  onRow(r);
                },
              } : {})}
              className={`block border-t border-line/70 px-3 py-3 sm:table-row sm:p-0 ${onRow ? 'cursor-pointer hover:bg-sand/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal' : ''}`}>
              {/* Raqam va sana hech qachon sinmaydi: "3-" / "sentabr" ikki qatorga bo'linib o'qilmas edi */}
              {cols.map((c) => (
                <td key={c.key} data-label={c.head}
                  className={`flex items-baseline justify-between gap-3 py-0.5 empty:hidden before:shrink-0 before:font-mono before:text-[11px] before:font-semibold before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] sm:table-cell sm:px-3 sm:py-2 sm:align-top sm:empty:table-cell sm:before:content-none ${c.num ? 'font-mono tabular-nums sm:whitespace-nowrap sm:text-right' : ''}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
          className="w-16 rounded-lg border border-line bg-white px-2 py-1 text-center font-mono text-sm text-navy outline-none focus:border-teal"
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

export function Pill({ tone = 'neutral', children }: { tone?: 'ok' | 'warn' | 'bad' | 'neutral'; children: React.ReactNode }) {
  const c = tone === 'ok' ? 'bg-teal-soft text-teal-ink' : tone === 'warn' ? 'bg-amber-soft text-amber-ink' : tone === 'bad' ? 'bg-red-50 text-red-700' : 'bg-sand text-muted';
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>{children}</span>;
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
 * Yon varaq: uzun tahrir formasi uchun. Markazdagi modal uzun formada ekranga sig'maydi
 * va orqadagi ro'yxatni butunlay yopadi; yon varaqda esa qaysi qatorni tahrir qilayotganing ko'rinib turadi.
 */
export function Drawer({ open, title, onClose, children, footer }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    // Ochilganda fokus varaq ichiga kirsin, aks holda Tab orqadagi ro'yxatni aylanib chiqadi
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy/25" onClick={onClose} aria-hidden="true" />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className="relative flex h-full w-full max-w-xl flex-col bg-sand shadow-2xl outline-none">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-5 py-3">
          <h2 className="truncate font-display text-lg font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} aria-label="X" className="rounded-full px-2 py-1 text-xl leading-none text-muted hover:bg-sand hover:text-navy">×</button>
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
