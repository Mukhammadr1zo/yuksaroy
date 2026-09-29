'use client';
/**
 * Obyekt sahifasining qobig'i: tashkilot, terminal, e'lon va foydalanuvchi sahifalari
 * bir xil ko'rinadi. Sarlavha, "Ro'yxatga qaytish", id nusxasi, Pill lar, amallar va
 * yorliqlar shu yerda bir marta yozilgan; har sahifa faqat o'z yorliqlarining ichini beradi.
 *
 * Yorliq URL da (?tab=): havola ulashiladi va yangilanganda o'sha yorliq ochiladi.
 * Faol yorliqning ichi faqat ochilganda chiziladi, shuning uchun har yorliq o'z
 * so'rovini faqat kerak bo'lganda yuboradi (Pul yorlig'i egadan boshqaga umuman yo'q).
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ArrowLeftIcon, CheckIcon, CopyIcon } from '@phosphor-icons/react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { AuditLink, BTN_GHOST, CARD, DataTable, Notice, Skeleton, errText, useAdminList, type Col } from './kit';
import { useAdminCrumb, useAdminMe } from './context';

export type TabKey = 'general' | 'related' | 'money' | 'history' | 'notes';
/** Izoh yozsa bo'ladigan obyektlar: API dagi NOTE_ENTITIES bilan bir xil. */
export type NoteEntity = 'Organization' | 'Terminal' | 'Listing' | 'User';
export type ObjectTab = {
  key: TabKey;
  label: string;
  /** Yorliqdagi son: Bog'liq (nechta bog'liq qator), Izohlar (kimdir ishlaganmi). */
  count?: number;
  /** Faqat egaga (Pul): operatorga yorliqning o'zi chizilmaydi. */
  owner?: boolean;
  render: () => React.ReactNode;
};

/** Paletaning "oxirgi ochilganlar" ro'yxati: faqat qulaylik, xususiy rejimda otsa jim o'tadi. */
const RECENT_KEY = 'ys-admin-recent';
const RECENT_MAX = 5;
function remember(href: string, label: string) {
  try {
    const old = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as { href: string; label: string }[];
    const next = [{ href, label }, ...old.filter((r) => r.href !== href)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* xususiy rejim */ }
}

export function ObjectPage({ entity, id, title, subtitle, pills, back, actions, tabs, loading, notFound, error, onRetry }: {
  entity: NoteEntity;
  id: string;
  title: string;
  subtitle?: string;
  pills?: React.ReactNode;
  /** Ro'yxat manzili. Brauzerning orqaga tugmasi filtrli ro'yxatga qaytadi (filtrlar URL da), bu havola toza ro'yxatga. */
  back: string;
  actions?: React.ReactNode;
  tabs: ObjectTab[];
  loading: boolean;
  notFound: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const to = useTranslations('admin.object');
  const tt = useTranslations('admin.table');
  const { isOwner } = useAdminMe();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const listRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const ready = !loading && !notFound && !error;
  // Nonushta yo'lida obyekt nomi; yuklanmaguncha yoki topilmasa bo'sh
  useAdminCrumb(ready ? title : null);
  useEffect(() => { if (ready) remember(pathname, title); }, [ready, pathname, title]);

  const visible = tabs.filter((x) => !x.owner || isOwner);
  const raw = sp.get('tab');
  const active = visible.find((x) => x.key === raw) ?? visible[0];
  const go = (key: TabKey) => {
    // Sukut yorlig'i URL ga yozilmaydi (toza manzil); replace: yorliq almashishi tarix yozuvi emas
    router.replace(key === 'general' ? pathname : `${pathname}?tab=${key}`, { scroll: false });
    listRef.current?.querySelector<HTMLElement>(`[data-tab="${key}"]`)?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!active) return;
    const i = visible.findIndex((x) => x.key === active.key);
    let next: number;
    switch (e.key) {
      case 'ArrowRight': next = (i + 1) % visible.length; break;
      case 'ArrowLeft': next = (i - 1 + visible.length) % visible.length; break;
      case 'Home': next = 0; break;
      case 'End': next = visible.length - 1; break;
      default: return;
    }
    e.preventDefault();
    go(visible[next]!.key);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(id); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ruxsat yo'q */ }
  };

  const backLink = (
    <Link href={back} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-ink hover:underline">
      <ArrowLeftIcon size={14} weight="bold" aria-hidden="true" />
      {to('back')}
    </Link>
  );

  if (notFound) {
    return (
      <div>
        {backLink}
        <Notice tone="err">{to('notFound')}</Notice>
        <Link href={back} className={`${BTN_GHOST} mt-3`}>{to('back')}</Link>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        {backLink}
        <Notice tone="err">{errText(error, t, t.has, tc('loadFailed'))}</Notice>
        {onRetry ? <button type="button" onClick={onRetry} className={`${BTN_GHOST} mt-3`}>{tt('retry')}</button> : null}
      </div>
    );
  }
  if (loading) {
    return (
      <div aria-busy="true">
        {backLink}
        <div className="mt-3 h-7 w-64 animate-pulse rounded bg-line/60" />
        <div className="mt-2 h-3 w-40 animate-pulse rounded bg-line/60" />
        <div className={`${CARD} mt-6 px-4 py-5`}><Skeleton rows={3} /></div>
      </div>
    );
  }

  return (
    <div>
      {backLink}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words font-display text-2xl font-bold text-navy">{title}</h1>
            {pills}
          </div>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
            <span className="break-all">{id}</span>
            <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-0.5 font-sans font-semibold text-navy hover:border-teal">
              {copied ? <CheckIcon size={12} weight="bold" aria-hidden="true" /> : <CopyIcon size={12} aria-hidden="true" />}
              {copied ? to('copied') : to('copyId')}
            </button>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {actions}
          <AuditLink entity={entity} id={id} />
          {/* Foydalanuvchining o'zi qilgan amallari: hisob tarixi emas, u Tarix yorlig'ida */}
          {entity === 'User' ? <Link href={`/admin/audit?actor=${id}`} className="text-xs font-semibold text-teal-ink hover:underline">{to('hisActions')}</Link> : null}
        </div>
      </div>

      {/* Mobilda yorliqlar gorizontal aylanadi: beshta nom bitta qatorga sig'maydi */}
      <div ref={listRef} role="tablist" aria-label={title} onKeyDown={onKey} className="mt-5 flex gap-1.5 overflow-x-auto pb-1">
        {visible.map((x) => {
          const on = x.key === active?.key;
          return (
            <button key={x.key} type="button" role="tab" id={`tab-${x.key}`} aria-selected={on} aria-controls={`panel-${x.key}`}
              tabIndex={on ? 0 : -1} data-tab={x.key} onClick={() => go(x.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-150 ${on ? 'bg-navy text-white' : 'border border-line bg-white text-navy hover:border-teal'}`}>
              {x.label}
              {x.count != null ? <span className={`font-mono text-[11px] tabular-nums ${on ? 'text-white/80' : 'text-muted'}`}>{x.count}</span> : null}
            </button>
          );
        })}
      </div>
      {active ? (
        <div role="tabpanel" id={`panel-${active.key}`} aria-labelledby={`tab-${active.key}`} className="mt-4">
          {active.render()}
        </div>
      ) : null}
    </div>
  );
}

/** Fakt kataklari: "kalit: qiymat" to'ri, telefonda ikki ustun. */
export const FACTS = `${CARD} grid grid-cols-2 gap-x-4 gap-y-2 p-3 text-sm wrap-anywhere`;
export function Fact({ k, v, mono = false }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{k}</dt>
      <dd className={`mt-0.5 font-semibold ${mono ? 'font-mono tabular-nums' : ''}`}>{v}</dd>
    </div>
  );
}

/** Yorliq ichidagi bo'lim sarlavhasi: nom + (bo'lsa) son + o'ngda havola. */
export function Section({ title, count, aside, children }: { title: string; count?: number; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">
          {title}{count != null ? <span className="ml-1.5 tabular-nums">{count}</span> : null}
        </h3>
        {aside ? <span className="ml-auto text-xs">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Bog'liq yorlig'idagi mini jadval: 10 ta qator va "Hammasi" havolasi filtrli ro'yxatga.
 * So'rov faqat yorliq ochilganda ketadi (komponent shunda mount bo'ladi).
 */
export function RelatedTable<T>({ title, path, filters, cols, keyOf, href, all }: {
  title: string; path: string; filters: Record<string, string | number | undefined>;
  cols: Col<T>[]; keyOf: (r: T) => string; href?: (r: T) => string;
  /** To'liq ro'yxat manzili (filtr bilan). */
  all: string;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const to = useTranslations('admin.object');
  // ponytail: 10 ta yetarli, ko'pi "Hammasi" orqali ro'yxatda
  const { data, loading, err } = useAdminList<T>(path, { ...filters, limit: 10 });
  return (
    <Section title={title} count={data?.total} aside={data?.total ? <Link href={all} className="font-semibold text-teal-ink hover:underline">{to('related.all')}</Link> : null}>
      {err ? <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice> : null}
      <DataTable cols={cols} rows={data?.items ?? []} keyOf={keyOf} empty={to('related.none')} loading={loading} href={href} />
    </Section>
  );
}
