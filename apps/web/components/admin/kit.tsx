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
 * Jadval. Admin ma'lumoti ustunlarga taqqoslanadi (qaysi biri eskiroq, qaysi biri kattaroq),
 * shuning uchun bu yerda kartochka emas, haqiqiy jadval. Tor ekranda yon tomonga suriladi
 * va sahifaning o'zi hech qachon gorizontal surilmaydi.
 */
export function DataTable<T>({ cols, rows, keyOf, empty, onRow }: {
  cols: Col<T>[]; rows: T[]; keyOf: (row: T) => string; empty: string; onRow?: (row: T) => void;
}) {
  if (!rows.length) return <div className={`${CARD} mt-4 border-dashed px-6 py-12 text-center text-sm text-muted`}>{empty}</div>;
  return (
    <div className={`${CARD} mt-4 overflow-x-auto`}>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-sand text-left">
          <tr>
            {cols.map((c) => (
              <th key={c.key} scope="col" style={c.width ? { width: c.width } : undefined}
                className={`whitespace-nowrap px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted ${c.num ? 'text-right' : ''}`}>
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={keyOf(r)} onClick={onRow ? () => onRow(r) : undefined}
              className={`border-t border-line/70 ${onRow ? 'cursor-pointer hover:bg-sand/60' : ''}`}>
              {/* Raqam va sana hech qachon sinmaydi: "3-" / "sentabr" ikki qatorga bo'linib o'qilmas edi */}
              {cols.map((c) => (
                <td key={c.key} className={`px-3 py-2 align-top ${c.num ? 'whitespace-nowrap text-right font-mono tabular-nums' : ''}`}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const t = useTranslations('pagination');
  if (pages <= 1) return null;
  return (
    <nav aria-label={t('aria')} className="mt-4 flex items-center justify-center gap-2 font-mono text-sm">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={BTN_GHOST}>{t('prev')}</button>
      <span className="px-2 tabular-nums text-muted">{page} / {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={BTN_GHOST}>{t('next')}</button>
    </nav>
  );
}

export function Pill({ tone = 'neutral', children }: { tone?: 'ok' | 'warn' | 'bad' | 'neutral'; children: React.ReactNode }) {
  const c = tone === 'ok' ? 'bg-teal-soft text-teal-ink' : tone === 'warn' ? 'bg-amber-soft text-amber-ink' : tone === 'bad' ? 'bg-red-50 text-red-700' : 'bg-sand text-muted';
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>{children}</span>;
}

export function Notice({ tone, children }: { tone: 'ok' | 'err'; children: React.ReactNode }) {
  return (
    <p role={tone === 'err' ? 'alert' : 'status'}
      className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${tone === 'err' ? 'bg-red-50 text-red-700' : 'bg-teal-soft text-teal-ink'}`}>
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
          timer.current = setTimeout(() => setArmed(false), 4000);
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
