'use client';
/**
 * Obyekt sahifasidagi chat.
 *
 * Ilgari bu yerda quruq maydon va "So'rov yuborish" tugmasi turardi: odam nima
 * yozganini, javob kelgan-kelmaganini ko'rmasdi va suhbatni davom ettirish uchun
 * kabinetga o'tishi kerak edi. Endi yon oyna ochiladi, yozishma tarixi bilan
 * birga, fayl biriktirish va yuborish shu yerda.
 *
 * Oyna alohida sahifa emas: odam terminal ma'lumotini ko'rib turib yozadi, ya'ni
 * narx so'rayotganda pasport ko'z oldida qoladi.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChatCircleDotsIcon, PaperPlaneRightIcon, XIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { api, hasSession, post } from '@/lib/api';
import { uzDateTime } from '@/lib/format';
import { AttachmentButton, AttachmentChips, MessageFiles, useAttachments, type Attachment } from './Attachments';

type Msg = { id: string; text: string; attachments: Attachment[]; createdAt: string; mine: boolean; author: string | null };
type Thread = { id: string; status: string; role: 'owner' | 'client'; createdAt: string; messages: Msg[] };
type Org = { orgId: string; org: { name: string } };

/** Ochiq oynada tez yangilanadi; yopilganda umuman so'ralmaydi. */
const POLL = 8_000;

export type ChatTarget =
  | { kind: 'terminal'; slug: string; title: string; ownerless?: boolean }
  | { kind: 'listing'; id: string; title: string };

const startPath = (t: ChatTarget) => (t.kind === 'terminal' ? `/terminals/${t.slug}/inquiries` : `/listings/${t.id}/inquiries`);
const findQuery = (t: ChatTarget) => (t.kind === 'terminal' ? `terminal=${encodeURIComponent(t.slug)}` : `listing=${encodeURIComponent(t.id)}`);

/** Tugma va oyna. Sahifa server tomonida chiziladi, shuning uchun holat shu yerda. */
export function ChatLauncher({ target, next }: { target: ChatTarget; next: string }) {
  const t = useTranslations('kabinet.chat');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-teal px-6 py-3 font-semibold text-white transition hover:bg-teal-ink active:scale-[0.98]"
      >
        <ChatCircleDotsIcon size={20} weight="fill" aria-hidden="true" />
        {t('write')}
      </button>
      {open ? <ChatPanel target={target} next={next} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ChatPanel({ target, next, onClose }: { target: ChatTarget; next: string; onClose: () => void }) {
  const t = useTranslations('kabinet.chat');
  const tc = useTranslations('kabinet.common');
  const locale = useLocale();
  const [authed, setAuthed] = useState<boolean | undefined>(undefined);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const at = useAttachments();

  const panel = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  // Esc yopadi va fokus oynaga kiradi: bu modal emas, lekin klaviatura bilan ham ishlashi kerak
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus(); };
  }, []);

  // Kim ekanini aniqlash va avvalgi yozishmani topish
  useEffect(() => {
    (async () => {
      if (!hasSession()) { setAuthed(false); return; }
      const me = await api('/auth/me').catch(() => null);
      setAuthed(me !== null);
      if (!me) return;
      const [mine, found] = await Promise.all([
        api<Org[]>('/orgs/mine').catch(() => [] as Org[]),
        api<{ id: string | null }>(`/inquiries/find?${findQuery(target)}`).catch(() => ({ id: null })),
      ]);
      setOrgs(mine);
      setOrgId(mine[0]?.orgId ?? '');
      if (found.id) setThreadId(found.id);
      else setMessages([]); // yozishma yo'q: bo'sh holat ko'rsatiladi
    })();
  }, [target]);

  const load = useCallback(async (id: string) => {
    const th = await api<Thread>(`/inquiries/${id}/thread`).catch(() => null);
    if (th) setMessages(th.messages);
  }, []);

  useEffect(() => { if (threadId) void load(threadId); }, [threadId, load]);
  useEffect(() => {
    if (!threadId) return;
    const timer = setInterval(() => { void load(threadId); }, POLL);
    return () => clearInterval(timer);
  }, [threadId, load]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages?.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    // Yuklash tugamaguncha yuborilmaydi, aks holda xabar faylsiz ketardi
    if ((!body && !at.files.length) || busy || at.busy > 0) return;
    if (!threadId && body.length < 5) { setErr(t('tooShort')); return; }
    setBusy(true); setErr(null);
    try {
      if (threadId) {
        const m = await post<Msg>(`/inquiries/${threadId}/messages`, { text: body, attachments: at.files });
        setMessages((x) => [...(x ?? []), m]);
      } else {
        // Birinchi xabar yozishmani ochadi va ilovalar ham shu bilan ketadi
        const inq = await post<{ id: string }>(startPath(target), { message: body, orgId: orgId || undefined, attachments: at.files });
        setThreadId(inq.id);
      }
      setText(''); at.clear();
    } catch { setErr(tc('failed')); } finally { setBusy(false); }
  }

  // Birinchi xabarda matn shart: egasiga kontekstsiz fayl tushsa savol tug'diradi
  const canSend = !busy && at.busy === 0 && (!!text.trim() || (!!threadId && at.files.length > 0));

  return (
    <div
      ref={panel} role="dialog" aria-modal="false" aria-label={t('windowTitle', { title: target.title })}
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-card border border-line bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[560px] sm:max-h-[calc(100dvh-6rem)] sm:w-[380px] sm:rounded-card"
    >
      <header className="flex items-start gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold wrap-anywhere">{target.title}</p>
          <p className="text-[11px] text-muted">{target.kind === 'terminal' && target.ownerless ? t('toPlatform') : t('toOwner')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={tc('close')} className="tap-40 relative -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-sand hover:text-navy">
          <XIcon size={16} weight="bold" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-sand/40 px-3 py-3">
        {authed === undefined ? <p className="text-sm text-muted">{tc('loading')}</p> : null}
        {authed === false ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <ChatCircleDotsIcon size={32} className="text-muted" aria-hidden="true" />
            <p className="text-sm text-muted">{t('loginToWrite')}</p>
            <Link href={`/login?next=${next}`} className="rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-ink">{t('login')}</Link>
          </div>
        ) : null}
        {authed && messages?.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <ChatCircleDotsIcon size={32} className="text-muted" aria-hidden="true" />
            <p className="text-sm text-muted">{t('emptyHint')}</p>
          </div>
        ) : null}
        {messages?.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] min-w-0 rounded-2xl px-3 py-2 ${m.mine ? 'bg-navy text-white' : 'bg-white text-ink ring-1 ring-line'}`}>
              {!m.mine && m.author ? <p className="text-[11px] font-semibold opacity-70">{m.author}</p> : null}
              {m.text ? <p className="whitespace-pre-line text-sm wrap-anywhere">{m.text}</p> : null}
              <MessageFiles files={m.attachments ?? []} mine={m.mine} />
              <p className={`mt-1 font-mono text-[10px] ${m.mine ? 'text-white/60' : 'text-muted'}`}>{uzDateTime(m.createdAt, locale)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      {authed ? (
        <form onSubmit={send} className="border-t border-line px-3 py-2">
          <AttachmentChips files={at.files} onRemove={at.remove} />
          {at.err ? <p role="alert" className="mb-1 text-xs font-semibold text-red-700">{at.err}</p> : null}
          {err ? <p role="alert" className="mb-1 text-xs font-semibold text-red-700">{err}</p> : null}
          {orgs.length && !threadId ? (
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} aria-label={t('asOrg')} className="mb-2 w-full rounded-xl border border-line bg-white px-3 py-1.5 text-xs">
              <option value="">{t('asPerson')}</option>
              {orgs.map((o) => <option key={o.orgId} value={o.orgId}>{o.org.name}</option>)}
            </select>
          ) : null}
          <div className="flex items-end gap-2">
            <AttachmentButton busy={at.busy} disabled={busy} onPick={at.add} />
            <textarea
              value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={threadId ? 2000 : 1000} placeholder={t('placeholder')}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              onPaste={(e) => {
                const pasted = Array.from(e.clipboardData.files);
                if (!pasted.length) return;
                e.preventDefault();
                void at.add(pasted);
              }}
              className="max-h-28 min-h-[44px] w-full min-w-0 resize-none rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/25"
            />
            <button disabled={!canSend} aria-label={t('send')} className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-teal text-white transition hover:bg-teal-ink disabled:opacity-50">
              <PaperPlaneRightIcon size={16} weight="fill" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted">{threadId ? t('enterHint') : t('firstHint')}</p>
        </form>
      ) : null}
    </div>
  );
}
