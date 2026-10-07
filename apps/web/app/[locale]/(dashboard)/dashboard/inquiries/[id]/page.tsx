'use client';
// Yozishma: mijoz va obyekt egasi shu yerda gaplashadi. Telefon ochiq bo'lgani bilan
// yozib qo'yish ham kerak: kelishuv izi va yuborilgan hujjat platformada qoladi.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PaperPlaneRightIcon } from '@phosphor-icons/react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ApiError, api, post } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import { Err } from '@/components/tg/bits';
import { BTN_GHOST } from '@/components/kabinet/bits';
import { AttachmentButton, AttachmentChips, MessageFiles, useAttachments, type Attachment } from '@/components/chat/Attachments';

type Msg = { id: string; text: string; attachments: Attachment[]; createdAt: string; mine: boolean; author: string | null };
type Subject = { kind: 'listing' | 'terminal'; id: string; slug: string; title: string; sub: string | null };
type Thread = { id: string; status: string; role: 'owner' | 'client'; createdAt: string; lastMessageAt: string | null; subject: Subject | null; messages: Msg[] };

/** Ochiq oynada tez, fonda kamdan kam: har suhbat uchun soatiga 180 emas, 30 ta so'rov. */
const POLL_ACTIVE = 8_000;
const POLL_HIDDEN = 120_000;

export default function InquiryThreadPage() {
  const t = useTranslations('kabinet.chat');
  const tc = useTranslations('kabinet.common');
  const ti = useTranslations('kabinet.inquiries');
  const tterm = useTranslations('terminal');
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const [thread, setThread] = useState<Thread | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState('');
  const at = useAttachments();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // "Javob shart emas" bosilgandagi lastMessageAt: tasdiq qatori suhbatga yangi xabar kelguncha turadi
  const [cleared, setCleared] = useState<string | null>();
  const done = useRef<HTMLParagraphElement>(null);
  const end = useRef<HTMLDivElement>(null);

  // So'rovlar raqamlanadi va javob faqat ko'rsatilganidan keyin ketgan so'rovdan olinadi: kechikib
  // kelgan eski javob "Javob shart emas" ni yoki yuborilgan xabarni bosib ketmasin. "Faqat eng
  // oxirgisi" emas: sekin internetda har javob keyingi yangilashdan keyin kelsa sahifa hech ochilmasdi
  const seq = useRef(0);
  const shown = useRef(0);
  const load = useCallback(() => {
    const n = ++seq.current;
    return api<Thread>(`/inquiries/${id}/thread`)
      .then((x) => { if (n > shown.current) { shown.current = n; setThread(x); setFailed(false); } })
      // Xato faqat hali hech narsa ko'rsatilmagan bo'lsa: telefonda internet bir zum uzilsa ochiq
      // suhbat "Yuklanmadi" ga almashib, keyingi muvaffaqiyatli yangilashda ham qaytmasdi
      .catch(() => { if (shown.current === 0) setFailed(true); });
  }, [id]);

  useEffect(() => { if (id) void load(); }, [id, load]);
  // Yangi xabar kelsa pastga tushadi
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [thread?.messages.length]);
  // Bosilgan tugma yo'qoladi: fokus sahifa boshiga uchib ketmasin, tasdiq qatoriga o'tadi
  useEffect(() => { if (cleared !== undefined) done.current?.focus(); }, [cleared]);
  // Yangilash tezligi ko'rinishga qarab: yopiq varaqda serverni behuda bezovta qilmaydi
  useEffect(() => {
    if (!id) return;
    let timer: ReturnType<typeof setInterval>;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => { void load(); }, document.hidden ? POLL_HIDDEN : POLL_ACTIVE);
    };
    const onVisible = () => { if (!document.hidden) void load(); start(); };
    start();
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [id, load]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    // Yuklash tugamaguncha yuborilmaydi: aks holda xabar faylsiz ketib,
    // fayl keyingi xabarga ilashib qolardi.
    if ((!body && !at.files.length) || busy || at.busy > 0) return;
    setBusy(true); setErr(null);
    try {
      const m = await post<Msg>(`/inquiries/${id}/messages`, { text: body, attachments: at.files });
      // Yuborishdan oldin ketgan yangilashlar eskirdi: ularning javobi bu xabarsiz keladi
      shown.current = seq.current;
      setThread((x) => (x ? { ...x, messages: [...x.messages, m] } : x));
      setText(''); at.clear();
      // Holat serverdan: egasi javob yozsa "Javob kutilmoqda" keyingi so'rovgacha (8 s) osilib turmasin
      void load();
    } catch (e) {
      // Namuna bilan avval ochilgan yozishma: server xabarni qabul qilmaydi, sababi ochiq aytiladi
      setErr(e instanceof ApiError && e.body?.code === 'DEMO_TARGET' ? tterm('demoNoChat') : tc('failed'));
    } finally { setBusy(false); }
  }

  /**
   * "Javob shart emas" (egasi qarori, 2026-10-07): xabar yozilmaydi, suhbat javob kutayotganlar
   * ro'yxatidan chiqadi. Ko'rilgan lastMessageAt yuboriladi: shu orada mijoz yana yozgan bo'lsa server
   * 409 qaytaradi va yangi holat darhol yuklanadi.
   */
  async function noReply() {
    if (!thread || busy) return;
    const seen = thread.lastMessageAt;
    setBusy(true); setErr(null);
    try {
      await post(`/inquiries/${id}/no-reply`, { lastMessageAt: seen });
      // Bosishdan oldin ketgan yangilash hali OPEN ni olib kelishi mumkin: u hisobga olinmaydi
      shown.current = seq.current;
      setThread((x) => (x ? { ...x, status: 'ANSWERED' } : x));
      setCleared(seen);
    } catch (e) {
      const changed = e instanceof ApiError && e.status === 409;
      setErr(changed ? t('noReplyChanged') : tc('failed'));
      if (changed) void load();
    } finally { setBusy(false); }
  }

  if (failed) return <p role="alert" className="text-sm text-red-700">{tc('loadFailed')}</p>;
  if (!thread) return <p className="text-sm text-muted">{tc('loading')}</p>;

  const s = thread.subject;
  const publicHref = s ? (s.kind === 'terminal' ? `/terminals/${s.slug}` : `/${s.sub === 'TRUCK' ? 'carriers' : 'equipment'}/${s.slug}`) : null;
  const canSend = !busy && at.busy === 0 && (!!text.trim() || at.files.length > 0);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/dashboard/inquiries" className="font-mono text-xs text-muted hover:text-navy">{t('back')}</Link>
          <h1 className="mt-1 truncate font-display text-xl font-bold">{s?.title ?? t('deletedSubject')}</h1>
          <p className="text-xs text-muted">{t(`role.${thread.role}`)} · {uzDateTime(thread.createdAt, locale)}</p>
        </div>
        {publicHref ? (
          <Link href={publicHref} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-teal">
            {s?.kind === 'terminal' ? t('openTerminal') : t('openListing')}
          </Link>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 rounded-card border border-line bg-white p-3 sm:p-4">
        {thread.messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] min-w-0 rounded-2xl px-3.5 py-2 ${m.mine ? 'bg-navy text-white' : 'bg-sand text-ink'}`}>
              {!m.mine && m.author ? <p className="text-[11px] font-semibold opacity-70">{m.author}</p> : null}
              {m.text ? <p className="whitespace-pre-line text-sm wrap-anywhere">{m.text}</p> : null}
              <MessageFiles files={m.attachments ?? []} mine={m.mine} />
              <p className={`mt-1 font-mono text-[10px] ${m.mine ? 'text-white/60' : 'text-muted'}`}>{uzDateTime(m.createdAt, locale)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      {/* Faqat qabul qiluvchi tomonga: mijoz o'z savolini yopa olmaydi (server ham rad etadi) */}
      {thread.role === 'owner' && thread.status === 'OPEN' ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="rounded-full bg-amber px-2.5 py-0.5 text-xs font-semibold text-ink">{ti('awaiting')}</span>
          <button type="button" onClick={() => void noReply()} disabled={busy} aria-describedby="no-reply-hint" className={BTN_GHOST}>{t('noReply')}</button>
          <p id="no-reply-hint" className="w-full text-xs text-muted">{t('noReplyHint')}</p>
        </div>
      ) : cleared !== undefined && cleared === thread.lastMessageAt ? (
        <p ref={done} tabIndex={-1} role="status" className="mt-3 text-xs font-semibold text-teal-ink outline-none">{t('noReplyDone')}</p>
      ) : null}

      <form onSubmit={send} className="mt-3">
        {/* Fayl ro'yxati qatordan tashqarida: aks holda telefonda yuborish tugmasini chetga surib yuborardi */}
        <AttachmentChips files={at.files} onRemove={at.remove} />
        {at.err ? <p role="alert" className="mb-2 text-xs font-semibold text-red-700">{at.err}</p> : null}
        <div className="flex items-end gap-2">
          <AttachmentButton busy={at.busy} disabled={busy} onPick={at.add} />
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder={t('placeholder')}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send(); }}
            onPaste={(e) => {
              // Ekran rasmini bevosita qo'yish: hujjat suratini yuborishning eng tez yo'li
              const pasted = Array.from(e.clipboardData.files);
              if (!pasted.length) return;
              e.preventDefault();
              void at.add(pasted);
            }}
            className="min-h-[52px] w-full min-w-0 rounded-xl border border-field bg-white px-4 py-2.5 text-base outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/25"
          />
          <button
            disabled={!canSend} aria-label={t('send')}
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-teal text-white transition hover:bg-teal-ink disabled:opacity-50"
          >
            <PaperPlaneRightIcon size={18} weight="fill" aria-hidden="true" />
          </button>
        </div>
      </form>
      <p className="mt-1 font-mono text-[11px] text-muted">{t('hint')}</p>
      {err ? <div className="mt-2"><Err>{err}</Err></div> : null}
    </>
  );
}
