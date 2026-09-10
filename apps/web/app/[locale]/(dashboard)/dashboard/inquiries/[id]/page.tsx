'use client';
// Yozishma: mijoz va e'lon egasi shu yerda gaplashadi. Telefon ochiq bo'lgani bilan
// yozib qo'yish ham kerak: kelishuv izi platformada qoladi.
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PaperPlaneRightIcon } from '@phosphor-icons/react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { api, post } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import { Err } from '@/components/tg/bits';

type Msg = { id: string; text: string; createdAt: string; mine: boolean; author: string | null };
type Thread = {
  id: string; status: string; role: 'owner' | 'client'; createdAt: string;
  listing: { id: string; slug: string; title: string; kind: string };
  messages: Msg[];
};

export default function InquiryThreadPage() {
  const t = useTranslations('kabinet.chat');
  const tc = useTranslations('kabinet.common');
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const [thread, setThread] = useState<Thread | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const load = () => api<Thread>(`/inquiries/${id}/thread`).then(setThread).catch(() => setFailed(true));
  useEffect(() => { if (id) void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Yangi xabar kelsa pastga tushadi; suhbat ochiq turganda har 20 soniyada yangilanadi
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [thread?.messages.length]);
  useEffect(() => {
    if (!id) return;
    const timer = setInterval(() => { void load(); }, 20_000);
    return () => clearInterval(timer);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setErr(null);
    try {
      const m = await post<Msg>(`/inquiries/${id}/messages`, { text: body });
      setThread((x) => (x ? { ...x, messages: [...x.messages, m] } : x));
      setText('');
    } catch { setErr(tc('failed')); } finally { setBusy(false); }
  }

  if (failed) return <p role="alert" className="text-sm text-red-700">{tc('loadFailed')}</p>;
  if (!thread) return <p className="text-sm text-muted">{tc('loading')}</p>;

  const publicHref = `/${thread.listing.kind === 'TRUCK' ? 'carriers' : 'equipment'}/${thread.listing.slug}`;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/dashboard/inquiries" className="font-mono text-xs text-muted hover:text-navy">{t('back')}</Link>
          <h1 className="mt-1 truncate font-display text-xl font-bold">{thread.listing.title}</h1>
          <p className="text-xs text-muted">{t(`role.${thread.role}`)} · {uzDateTime(thread.createdAt, locale)}</p>
        </div>
        <Link href={publicHref} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-teal">{t('openListing')}</Link>
      </div>

      <div className="mt-4 space-y-2 rounded-card border border-line bg-white p-3 sm:p-4">
        {thread.messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${m.mine ? 'bg-navy text-white' : 'bg-sand text-ink'}`}>
              {!m.mine && m.author ? <p className="text-[11px] font-semibold opacity-70">{m.author}</p> : null}
              <p className="whitespace-pre-line text-sm">{m.text}</p>
              <p className={`mt-1 font-mono text-[10px] ${m.mine ? 'text-white/60' : 'text-muted'}`}>{uzDateTime(m.createdAt, locale)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      <form onSubmit={send} className="mt-3 flex items-end gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder={t('placeholder')}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send(e as unknown as React.FormEvent); }}
          className="min-h-[52px] w-full rounded-xl border border-line bg-white px-4 py-2.5 text-base outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/25" />
        <button disabled={busy || !text.trim()} aria-label={t('send')}
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-teal text-white transition hover:bg-teal-ink disabled:opacity-50">
          <PaperPlaneRightIcon size={18} weight="fill" aria-hidden="true" />
        </button>
      </form>
      <p className="mt-1 font-mono text-[11px] text-muted">{t('hint')}</p>
      {err ? <div className="mt-2"><Err>{err}</Err></div> : null}
    </>
  );
}
