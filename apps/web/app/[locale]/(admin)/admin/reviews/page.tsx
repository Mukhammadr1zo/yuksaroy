'use client';
/**
 * Baholar: terminal baholari va e'lon izohlari.
 *
 * Nega kerak: API da bu ikkalasini o'qish va o'chirish allaqachon bor edi, lekin panelda
 * ekran yo'q edi. Ya'ni terminalga soxta bir yulduz yozilsa yoki izohda haqorat bo'lsa,
 * operator uni topa ham, o'chira ham olmasdi.
 *
 * Terminal bahosi o'chirilganda server terminal reytingini qaytadan hisoblaydi, shuning
 * uchun kartochkadagi raqam ham darrov to'g'rilanadi.
 *
 * Jadval bitta: ikki ro'yxatning farqi faqat "nima haqida" katagida. Buyurtma raqami
 * o'sha katak ostida, reytingga kirmasligi esa bahoning yonida turadi: ikkalasi ham
 * yonidagi qiymatsiz ma'nosiz, alohida ustun bo'lib turishi shart emas.
 *
 * Holat URL da (useListQuery): terminal va e'lon obyekt sahifalari "Baholar" havolasini
 * ?terminalId= va ?listingId= bilan yuboradi, orqaga tugmasi filtrni qaytaradi.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import {
  BTN_DANGER, BTN_GHOST, ConfirmButton, DataTable, INPUT, Labeled, Notice, PageHead, Pager, Pill, Toolbar,
  errText, useAdminList, useListQuery, type Col,
} from '@/components/admin/kit';

type Tab = 'terminal' | 'listing';
/** URL dagi holat: sukut qiymat manzilga yozilmaydi. tab bo'sh bo'lsa listingId dan aniqlanadi. */
const F0 = { tab: '', q: '', terminalId: '', listingId: '', page: 1 };
type Base = { id: string; rating: number; text: string | null; reply: string | null; createdAt: string; author: string | null };
type TerminalReview = Base & {
  orderNo: string; excluded: boolean;
  terminal: { id: string; name: string; slug: string };
  org: { id: string; name: string } | null;
};
type ListingReview = Base & { listing: { id: string; title: string; slug: string } };
type Review = TerminalReview | ListingReview;
const isTerminal = (r: Review): r is TerminalReview => 'terminal' in r;

const SM = 'px-3 py-1 text-xs';

/** Past baho ko'zga tashlansin: operator aynan shularni qidiradi. */
function Stars({ n }: { n: number }) {
  return <span className={`font-mono text-sm font-semibold tabular-nums ${n <= 2 ? 'text-red-700' : 'text-navy'}`}>{n}/5</span>;
}

export default function AdminReviewsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tv = useTranslations('admin.reviews');
  const tt = useTranslations('admin.table');

  const { f, set } = useListQuery(F0);
  // E'lon sahifasidan ?listingId= bilan kelganda e'lon yorlig'i ochilsin, yorliqni qo'lda tanlash shart bo'lmasin
  const tab: Tab = f.tab === 'listing' || (!f.tab && f.listingId) ? 'listing' : 'terminal';
  const [qInput, setQInput] = useState(f.q);
  useEffect(() => setQInput(f.q), [f.q]);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const path = tab === 'terminal' ? '/admin/reviews' : '/admin/listing-reviews';
  // Har yorliq faqat o'z obyekt filtrini yuboradi: /admin/reviews listingId ni bilmaydi va aksincha
  const objectId = tab === 'terminal' ? f.terminalId : f.listingId;
  const list = useAdminList<Review>(path, { q: f.q, page: f.page, [tab === 'terminal' ? 'terminalId' : 'listingId']: objectId });

  // Yorliq almashganda obyekt filtri ham ketadi: terminal id e'lon ro'yxatida ma'nosiz
  const switchTab = (k: Tab) => { set({ tab: k, terminalId: '', listingId: '' }); setNote(null); };

  async function remove(id: string) {
    setNote(null);
    try {
      await api(`${path}/${id}`, { method: 'DELETE' });
      setNote({ tone: 'ok', text: tv('deleted') });
      await list.reload();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); }
  }

  return (
    <>
      <PageHead title={t('nav.reviews')} lead={tv('lead')} />

      <div className="mt-4 flex flex-wrap gap-2">
        {(['terminal', 'listing'] as Tab[]).map((k) => (
          <button key={k} type="button" onClick={() => switchTab(k)} aria-pressed={tab === k}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors duration-150 ${
              tab === k ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink hover:border-teal'}`}>
            {tv(k === 'terminal' ? 'tabTerminal' : 'tabListing')}
          </button>
        ))}
      </div>

      <Toolbar onSubmit={() => set({ q: qInput.trim() })}>
        <Labeled label={tc('search')} className="w-72">
          <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={tv('searchHint')} className={INPUT} data-search="1" />
        </Labeled>
        <button type="submit" className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors duration-150 hover:border-teal">{tc('apply')}</button>
        {/* Obyekt sahifasidan kelgan filtr ko'rinmas edi: operator "nega ro'yxat qisqa" deb o'ylamasin */}
        {objectId ? (
          <button type="button" onClick={() => set({ terminalId: '', listingId: '' })} className={`${BTN_GHOST} px-3 py-1.5 text-xs`}>{tt('clearFilters')}</button>
        ) : null}
        {list.data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: list.data.total })}</span> : null}
      </Toolbar>

      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      {list.loading ? <p className="mt-4 text-sm text-muted">{tc('loading')}</p> : null}
      {list.err ? <Notice tone="err">{errText(list.err, t, t.has, tc('loadFailed'))}</Notice> : null}

      {list.data && !list.loading ? <ReviewTable rows={list.data.items} onDelete={remove} /> : null}

      <Pager page={f.page} pages={list.pages} onPage={(p) => set({ page: p })} />
    </>
  );
}

/** Baho matni va terminal javobi: uzun matn kartochkani yormasin. */
function TextCell({ r }: { r: Base }) {
  const tv = useTranslations('admin.reviews');
  return (
    <div className="min-w-0 max-w-md wrap-anywhere">
      <span>{r.text || <span className="text-muted">{tv('noText')}</span>}</span>
      {r.reply ? <span className="mt-1 block border-l-2 border-line pl-2 text-xs text-muted">{tv('reply')}: {r.reply}</span> : null}
    </div>
  );
}

function ReviewTable({ rows, onDelete }: { rows: Review[]; onDelete: (id: string) => Promise<void> }) {
  const tc = useTranslations('admin.common');
  const tv = useTranslations('admin.reviews');
  const locale = useLocale();
  const cols: Col<Review>[] = [
    { key: 'rating', head: tv('rating'), num: true, cell: (r) => (
      <div className="flex flex-col items-end gap-1">
        <Stars n={r.rating} />
        {/* Arms-length: buyurtmachi va terminal egasi bir tomon bo'lsa baho reytingga kirmaydi */}
        {isTerminal(r) && r.excluded ? <Pill tone="warn">{tv('excluded')}</Pill> : null}
      </div>
    ) },
    { key: 'target', head: tv('target'), cell: (r) => (isTerminal(r) ? (
      <div className="min-w-0">
        <Link href={`/terminals/${r.terminal.slug}`} target="_blank" className="font-semibold text-teal-ink underline wrap-anywhere">{r.terminal.name}</Link>
        <div className="font-mono text-xs text-muted">{tv('orderNo')}: {r.orderNo}</div>
      </div>
    ) : <span className="font-semibold wrap-anywhere">{r.listing.title}</span>) },
    { key: 'text', head: tv('text'), cell: (r) => <TextCell r={r} /> },
    { key: 'author', head: tv('author'), cell: (r) => (
      <div className="min-w-0 wrap-anywhere">
        <span>{r.author || <span className="text-muted">{tv('noAuthor')}</span>}</span>
        {isTerminal(r) && r.org ? <span className="block text-xs text-muted">{r.org.name}</span> : null}
      </div>
    ) },
    { key: 'createdAt', head: tc('createdAt'), num: true, cell: (r) => uzDateTime(r.createdAt, locale) },
    { key: 'actions', head: tc('actions'), cell: (r) => (
      <ConfirmButton label={tc('delete')} confirm={tc('confirm')} onRun={() => onDelete(r.id)} className={`${BTN_DANGER} ${SM}`} />
    ) },
  ];
  return <DataTable cols={cols} rows={rows} keyOf={(r) => r.id} empty={tc('empty')} />;
}
