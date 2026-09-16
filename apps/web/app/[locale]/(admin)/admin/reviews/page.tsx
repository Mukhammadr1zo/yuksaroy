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
 * Ikki jadval alohida komponent: shakllari boshqa, bitta jadvalga tiqilsa har katakda
 * "qaysi turdagi qator" deb tekshirish kerak bo'lardi.
 */
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import {
  BTN_DANGER, ConfirmButton, DataTable, INPUT, Labeled, Notice, PageHead, Pager, Pill, Toolbar,
  errText, useAdminList, type Col,
} from '@/components/admin/kit';

type Tab = 'terminal' | 'listing';
type Base = { id: string; rating: number; text: string | null; reply: string | null; createdAt: string; author: string | null };
type TerminalReview = Base & {
  orderNo: string; excluded: boolean;
  terminal: { id: string; name: string; slug: string };
  org: { id: string; name: string } | null;
};
type ListingReview = Base & { listing: { id: string; title: string; slug: string } };

const SM = 'px-3 py-1 text-xs';

/** Past baho ko'zga tashlansin: operator aynan shularni qidiradi. */
function Stars({ n }: { n: number }) {
  return <span className={`font-mono text-sm font-semibold tabular-nums ${n <= 2 ? 'text-red-700' : 'text-navy'}`}>{n}/5</span>;
}

export default function AdminReviewsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tv = useTranslations('admin.reviews');

  const [tab, setTab] = useState<Tab>('terminal');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const path = tab === 'terminal' ? '/admin/reviews' : '/admin/listing-reviews';
  const list = useAdminList<TerminalReview | ListingReview>(path, { q, page });

  const switchTab = (k: Tab) => { setTab(k); setPage(1); setQ(''); setQInput(''); setNote(null); };

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

      <Toolbar onSubmit={() => { setQ(qInput.trim()); setPage(1); }}>
        <Labeled label={tc('search')} className="w-72">
          <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={tv('searchHint')} className={INPUT} />
        </Labeled>
        <button type="submit" className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors duration-150 hover:border-teal">{tc('apply')}</button>
        {list.data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: list.data.total })}</span> : null}
      </Toolbar>

      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      {list.loading ? <p className="mt-4 text-sm text-muted">{tc('loading')}</p> : null}
      {list.err ? <Notice tone="err">{errText(list.err, t, t.has, tc('loadFailed'))}</Notice> : null}

      {list.data && !list.loading ? (
        tab === 'terminal'
          ? <TerminalTable rows={list.data.items as TerminalReview[]} onDelete={remove} />
          : <ListingTable rows={list.data.items as ListingReview[]} onDelete={remove} />
      ) : null}

      <Pager page={page} pages={list.pages} onPage={setPage} />
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

function DeleteCell({ id, onDelete }: { id: string; onDelete: (id: string) => Promise<void> }) {
  const tc = useTranslations('admin.common');
  return <ConfirmButton label={tc('delete')} confirm={tc('confirm')} onRun={() => onDelete(id)} className={`${BTN_DANGER} ${SM}`} />;
}

function TerminalTable({ rows, onDelete }: { rows: TerminalReview[]; onDelete: (id: string) => Promise<void> }) {
  const tc = useTranslations('admin.common');
  const tv = useTranslations('admin.reviews');
  const locale = useLocale();
  const cols: Col<TerminalReview>[] = [
    { key: 'rating', head: tv('rating'), num: true, cell: (r) => <Stars n={r.rating} /> },
    { key: 'target', head: tv('terminal'), cell: (r) => (
      <Link href={`/terminals/${r.terminal.slug}`} target="_blank" className="font-semibold text-teal-ink underline wrap-anywhere">{r.terminal.name}</Link>
    ) },
    { key: 'text', head: tv('text'), cell: (r) => <TextCell r={r} /> },
    { key: 'author', head: tv('author'), cell: (r) => (
      <div className="min-w-0 wrap-anywhere">
        <span>{r.author || <span className="text-muted">{tv('noAuthor')}</span>}</span>
        {r.org ? <span className="block text-xs text-muted">{r.org.name}</span> : null}
      </div>
    ) },
    { key: 'order', head: tv('orderNo'), num: true, cell: (r) => r.orderNo },
    // Arms-length: buyurtmachi va terminal egasi bir tomon bo'lsa baho reytingga kirmaydi
    { key: 'flags', head: tv('flags'), cell: (r) => (r.excluded ? <Pill tone="warn">{tv('excluded')}</Pill> : null) },
    { key: 'createdAt', head: tc('createdAt'), num: true, cell: (r) => uzDateTime(r.createdAt, locale) },
    { key: 'actions', head: tc('actions'), cell: (r) => <DeleteCell id={r.id} onDelete={onDelete} /> },
  ];
  return <DataTable cols={cols} rows={rows} keyOf={(r) => r.id} empty={tc('empty')} />;
}

function ListingTable({ rows, onDelete }: { rows: ListingReview[]; onDelete: (id: string) => Promise<void> }) {
  const tc = useTranslations('admin.common');
  const tv = useTranslations('admin.reviews');
  const locale = useLocale();
  const cols: Col<ListingReview>[] = [
    { key: 'rating', head: tv('rating'), num: true, cell: (r) => <Stars n={r.rating} /> },
    { key: 'target', head: tv('listing'), cell: (r) => <span className="font-semibold wrap-anywhere">{r.listing.title}</span> },
    { key: 'text', head: tv('text'), cell: (r) => <TextCell r={r} /> },
    { key: 'author', head: tv('author'), cell: (r) => r.author || <span className="text-muted">{tv('noAuthor')}</span> },
    { key: 'createdAt', head: tc('createdAt'), num: true, cell: (r) => uzDateTime(r.createdAt, locale) },
    { key: 'actions', head: tc('actions'), cell: (r) => <DeleteCell id={r.id} onDelete={onDelete} /> },
  ];
  return <DataTable cols={cols} rows={rows} keyOf={(r) => r.id} empty={tc('empty')} />;
}
