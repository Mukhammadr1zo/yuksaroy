'use client';
/**
 * Ctrl+K buyruq paleti: raqam (PAY-, SR-, YS-, UR-, telefon) bir sakrashda ochiladi,
 * sahifalar va buyruqlar mahalliy, erkin matn serverdan (/admin/search) keladi.
 *
 * Nega bitta ro'yxat: operator "PAY-1042 qayerda" deb o'ylamasdan yozadi, paleta o'zi
 * qaysi ekran ekanini biladi (parse-query.ts). Erkin matnda esa to'g'ri obyektni tanlash
 * uchun har natijada holat nishoni va mono qo'shimcha (telefon, slug) turadi.
 *
 * '?' bilan shu paleta yo'llar ro'yxati rejimida ochiladi: alohida varaq yo'q.
 * Tab dialog ichida qamalgan, Esc va fon bosish yopadi, strelka va Enter ro'yxatda yuradi.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Notice, Pill, Skeleton } from './kit';
import { GROUPS } from './AdminNav';
import { useAdminShell } from './context';
import { parseAdminQuery } from './parse-query';

type Hit = { kind: 'org' | 'terminal' | 'user' | 'listing'; id: string; title: string; sub: string | null; status: string };
type Tone = 'ok' | 'warn' | 'bad' | 'neutral';
type Row = { id: string; group: string; label: string; sub?: string | null; pill?: { tone: Tone; text: string }; href?: string; run?: () => void };

/** ObjectPage (D) yozadi, paleta faqat o'qiydi: { href, label }[], 5 tagacha. */
const RECENT_KEY = 'ys-admin-recent';
/** Manzil mijozda kind bo'yicha: API panel yo'llarini bilmaydi. */
const HIT_HREF: Record<Hit['kind'], string> = { org: '/admin/orgs/', terminal: '/admin/terminals/', user: '/admin/users/', listing: '/admin/listings/' };
const HIT_GROUP: Record<Hit['kind'], 'orgs' | 'terminals' | 'users' | 'listings'> = { org: 'orgs', terminal: 'terminals', user: 'users', listing: 'listings' };
const ORG_CHECK_TONE: Record<string, Tone> = { VERIFIED: 'ok', PENDING: 'warn', REJECTED: 'bad' };

export function CommandPalette({ mode, onClose }: { mode: 'search' | 'keys' | null; onClose: () => void }) {
  const tp = useTranslations('admin.palette');
  const ts = useTranslations('admin.shell');
  const tn = useTranslations('admin.nav');
  const tk = useTranslations('kyc');
  const tls = useTranslations('kabinet.status');
  const tts = useTranslations('terminalsAdmin.status');
  const router = useRouter();
  const { isOwner } = useAdminShell();
  const open = mode !== null;

  const [keys, setKeys] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);
  const [index, setIndex] = useState(0);
  const [recent, setRecent] = useState<{ href: string; label: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // Paleta ochilishidan oldingi fokus: yopilganda o'sha joyga qaytariladi
  const prevFocus = useRef<HTMLElement | null>(null);

  // Har ochilishda toza holat: eski so'rov matni keyingi safar chalg'itmasin
  useEffect(() => {
    if (!open) return;
    setKeys(mode === 'keys');
    setQ(''); setHits([]); setErr(false); setLoading(false); setIndex(0);
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as { href: string; label: string }[];
      setRecent(Array.isArray(v) ? v.filter((r) => r && typeof r.href === 'string' && typeof r.label === 'string').slice(0, 5) : []);
    } catch { setRecent([]); }
  }, [open, mode]);
  // Fokus dialog ichida: qidiruvda inputga, yo'llar ro'yxatida qutining o'ziga (input yo'q),
  // aks holda Esc hujjatga tushardi va qobiq uni ochiq dialog deb e'tiborsiz qoldirardi
  useEffect(() => {
    if (!open) {
      // Yopilganda fokus Ctrl+K bosilgan joyga qaytadi: klaviatura bilan yurgan odam
      // paleta yopilgach sahifaning boshiga tushib, yo'lini qaytadan qidirmasin
      prevFocus.current?.focus();
      prevFocus.current = null;
      return;
    }
    // ??= : effekt yo'llar ro'yxati rejimiga o'tganda ham yuradi, o'shanda eslab qo'yilgan
    // joy paletaning o'z tugmasiga almashib ketmasin - faqat birinchi ochilishdagisi saqlanadi
    prevFocus.current ??= document.activeElement as HTMLElement | null;
    if (keys) box.current?.focus(); else input.current?.focus();
  }, [open, keys]);

  const text = q.trim();
  const prefix = useMemo(() => parseAdminQuery(text), [text]);
  useEffect(() => { setIndex(0); }, [text]);

  // Server qidiruvi: 250 ms kutadi (har harfda so'rov ketmasin), yangi harf eskisini bekor qiladi.
  // Prefiks mos kelsa serverga ketmaydi: raqamni server ham topmaydi, manzil allaqachon ma'lum.
  useEffect(() => {
    if (!open || keys || prefix || text.length < 2) { setHits([]); setLoading(false); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setErr(false);
      api<{ hits: Hit[] }>(`/admin/search?q=${encodeURIComponent(text)}`, { signal: ctrl.signal })
        .then((r) => { setHits(r.hits); setLoading(false); })
        .catch(() => { if (!ctrl.signal.aborted) { setErr(true); setLoading(false); } });
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [open, keys, text, prefix]);

  const pillOf = (h: Hit): Row['pill'] => {
    switch (h.kind) {
      case 'org': return { tone: ORG_CHECK_TONE[h.status] ?? 'neutral', text: tk.has(h.status) ? tk(h.status) : h.status };
      case 'terminal': return h.status === 'ACTIVE' ? { tone: 'ok', text: tp('active') } : h.status === 'HIDDEN' ? { tone: 'neutral', text: tp('hidden') } : { tone: 'neutral', text: tts.has(h.status) ? tts(h.status) : h.status };
      // Faol foydalanuvchida nishon yo'q: faqat bloklangani qaror uchun muhim
      case 'user': return h.status === 'BLOCKED' ? { tone: 'bad', text: tp('blocked') } : undefined;
      case 'listing': return { tone: h.status === 'ACTIVE' ? 'ok' : 'warn', text: tls.has(h.status) ? tls(h.status) : h.status };
    }
  };

  const rows = useMemo<Row[]>(() => {
    const lc = text.toLowerCase();
    const out: Row[] = [];
    if (prefix) out.push({ id: 'open', group: '', label: tp('open', { q: text }), href: prefix.href });
    for (const it of GROUPS.flatMap((g) => g.items)) {
      if (it.owner && !isOwner) continue;
      const label = tn(it.key);
      // Nom joriy tilda, kalit esa lotincha: ruscha interfeysda "orgs" deb yozsa ham topadi
      if (lc && !label.toLowerCase().includes(lc) && !it.key.includes(lc)) continue;
      out.push({ id: `p:${it.key}`, group: tp('pages'), label, href: it.href, sub: it.hotkey ? `g ${it.hotkey}` : null });
    }
    const cmds: Row[] = [
      { id: 'c:terminal', group: tp('commands'), label: ts('quick.newTerminal'), href: '/admin/terminals?new=1' },
      { id: 'c:plan', group: tp('commands'), label: ts('quick.newPlan'), href: '/admin/plans?new=1' },
      ...(isOwner ? [{ id: 'c:ad', group: tp('commands'), label: ts('quick.newAd'), href: '/admin/ads?new=1' }] : []),
      { id: 'c:keys', group: tp('commands'), label: ts('keys.title'), sub: '?', run: () => setKeys(true) },
    ];
    out.push(...cmds.filter((r) => !lc || r.label.toLowerCase().includes(lc)));
    if (!lc) out.push(...recent.map((r, i) => ({ id: `r:${i}`, group: tp('recent'), label: r.label, href: r.href })));
    // Server natijalari tur bo'yicha guruhlanadi (API shu tartibda beradi: tashkilot, terminal, odam, e'lon)
    out.push(...hits.map((h): Row => ({ id: `${h.kind}:${h.id}`, group: tp(HIT_GROUP[h.kind]), label: h.title, sub: h.sub, pill: pillOf(h), href: HIT_HREF[h.kind] + h.id })));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, prefix, hits, recent, isOwner]);

  // Tanlangan qator ko'rinib tursin: uzun ro'yxatda strelka pastga tushganda aylantiradi
  useEffect(() => {
    box.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const go = (r: Row) => {
    if (r.run) { r.run(); return; }
    if (r.href) { router.push(r.href); onClose(); }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Hujjat darajasidagi tinglovchilar (BulkBar, Drawer) shu Esc ni olmasin: paleta yopilishi tanlovni tozalamasin
      e.preventDefault(); e.stopPropagation(); onClose(); return;
    }
    if (e.key === 'Tab') {
      const els = Array.from(box.current?.querySelectorAll<HTMLElement>('input,button:not(:disabled),a[href]') ?? []);
      const first = els[0]; const last = els[els.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }
    if (keys) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { const r = rows[index]; if (r) { e.preventDefault(); go(r); } }
  };

  // Yo'llar ro'yxati: g + harf qatorlari GROUPS dan, qolgan matnlar kalitning o'zini aytadi
  const keyRows: { k?: string; text: string }[] = [
    { k: 'Ctrl K', text: ts('keys.palette') },
    { text: ts('keys.go') },
    ...GROUPS.flatMap((g) => g.items).filter((it) => it.hotkey && (!it.owner || isOwner)).map((it) => ({ k: `g ${it.hotkey}`, text: tn(it.key) })),
    { text: ts('keys.search') }, { text: ts('keys.help') }, { text: ts('keys.nav') },
    { text: ts('keys.rowNext') }, { text: ts('keys.rowPrev') }, { text: ts('keys.rowOpen') }, { text: ts('keys.rowSelect') }, { text: ts('keys.rowMenu') }, { text: ts('keys.esc') },
  ];

  const title = keys ? ts('keys.title') : ts('search');
  let lastGroup: string | null = null;
  return (
    <div className="fixed inset-0 z-[60] flex sm:items-start sm:justify-center sm:pt-[10vh]">
      <div className="absolute inset-0 bg-navy/25" onClick={onClose} aria-hidden="true" />
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKey}
        className="relative flex h-dvh w-full flex-col bg-white shadow-2xl outline-none sm:h-auto sm:max-h-[70vh] sm:max-w-[640px] sm:rounded-card sm:border sm:border-line"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          {keys ? (
            <h2 className="flex-1 font-display text-base font-bold text-navy">{title}</h2>
          ) : (
            <>
              <MagnifyingGlassIcon size={18} aria-hidden="true" className="shrink-0 text-muted" />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tp('placeholder')}
                inputMode="search" autoComplete="off" spellCheck={false} aria-label={ts('search')}
                role="combobox" aria-expanded="true" aria-controls="ys-palette-list" aria-activedescendant={rows[index] ? `ys-pal-${index}` : undefined}
                className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted/70 sm:text-sm" />
            </>
          )}
          <button type="button" onClick={onClose} aria-label={ts('close')} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sand hover:text-navy">
            <XIcon size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>

        {keys ? (
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {keyRows.map((r, i) => (
              <li key={i} className="flex min-h-11 items-center gap-3 px-2 py-1.5 text-sm">
                {r.k ? <kbd className="shrink-0 rounded border border-line bg-sand px-1.5 font-mono text-[11px] text-navy">{r.k}</kbd> : null}
                <span className={r.k ? 'text-ink' : 'text-muted'}>{r.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <>
            {err ? <div className="px-3"><Notice tone="err">{tp('error')}</Notice></div> : null}
            <ul id="ys-palette-list" role="listbox" aria-label={title} className="min-h-0 flex-1 overflow-y-auto p-2">
              {rows.map((r, i) => {
                const head = r.group && r.group !== lastGroup ? r.group : null;
                lastGroup = r.group;
                const on = i === index;
                return (
                  <Fragment key={r.id}>
                    {head ? <li role="presentation" className="px-2 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted">{head}</li> : null}
                    <li id={`ys-pal-${i}`} role="option" aria-selected={on} data-idx={i} onClick={() => go(r)} onMouseMove={() => { if (!on) setIndex(i); }}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm ${on ? 'bg-sand' : ''}`}>
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">{r.label}</span>
                      {r.pill ? <Pill tone={r.pill.tone}>{r.pill.text}</Pill> : null}
                      {r.sub ? <span className="hidden shrink-0 font-mono text-[11px] text-muted sm:inline">{r.sub}</span> : null}
                    </li>
                  </Fragment>
                );
              })}
              {/* Yuklanmoqda: eski natija turadi, ostida skelet; sakrash yo'q */}
              {loading ? <li role="presentation" className="px-3 py-2"><Skeleton rows={3} /></li> : null}
              {!rows.length && !loading ? (
                <li role="presentation" className="px-3 py-6 text-center text-sm text-muted">
                  <p>{tp('empty')}</p>
                  {text ? <Link href={`/admin/users?q=${encodeURIComponent(text)}`} onClick={onClose} className="mt-2 inline-block font-semibold text-teal-ink hover:underline">{tp('searchUsers')}</Link> : null}
                </li>
              ) : null}
            </ul>
            <p className="hidden border-t border-line px-3 py-1.5 text-[11px] text-muted sm:block">{tp('hint')}</p>
          </>
        )}
      </div>
    </div>
  );
}
