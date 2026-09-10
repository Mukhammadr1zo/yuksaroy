'use client';
// Buyurtma sahifasidagi baho: yuk egasi (DONE, baho yo'q) beradi, terminal xodimi javob yozadi.
// Rol: /orgs/mine ichida buyurtmachi tashkilot bo'lsa yuk egasi, aks holda terminal tomoni (sahifani faqat tomonlar ochadi).
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { REVIEW } from '@yuksaroy/domain';
import { api, post } from '@/lib/api';
import { uzDate } from '@/lib/format';
import type { Membership } from '@/lib/types-kabinet';
import type { OrderReview as R } from '@/lib/types-trust';
import { BTN_GHOST, BTN_PRIMARY, INPUT, Notice, errText } from '@/components/kabinet/bits';
import { Stars } from './Stars';

export function OrderReview({ no, shipperOrgId }: { no: string; shipperOrgId: string }) {
  const [review, setReview] = useState<R | null | undefined>(undefined);
  const [shipper, setShipper] = useState<boolean | null>(null);
  useEffect(() => {
    api<R | null>(`/orders/${no}/review`).then((r) => setReview(r ?? null)).catch(() => setReview(null));
    api<Membership[]>('/orgs/mine').then((ms) => setShipper(ms.some((m) => m.orgId === shipperOrgId))).catch(() => setShipper(false));
  }, [no, shipperOrgId]);
  if (review === undefined || shipper === null) return null;
  if (!review) return shipper ? <ReviewForm no={no} onDone={setReview} /> : null;
  return <ReviewCard r={review} canReply={!shipper} onReply={setReview} />;
}

/** Yulduz tanlovi: 5 ta tugma, klaviatura bilan ham. */
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = useTranslations('reviews');
  return (
    <div role="radiogroup" aria-label={t('form.rating')} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={t('star', { n })} onClick={() => onChange(n)} className={`text-2xl leading-none transition ${n <= value ? 'text-amber' : 'text-line hover:text-amber/60'}`}>★</button>
      ))}
    </div>
  );
}

function ReviewForm({ no, onDone }: { no: string; onDone: (r: R) => void }) {
  const t = useTranslations('reviews');
  const te = useTranslations('reviews.err');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setBusy(true); setErr(null);
    try { onDone(await post<R>(`/orders/${no}/review`, { rating, text: text.trim() || undefined })); } // ota komponent kartaga o'tadi
    catch (e) { setErr(errText(e, te, te.has, te('failed'))); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="font-semibold">{t('form.title')}</h3>
      <p className="text-sm text-muted">{t('form.lead')}</p>
      <StarPicker value={rating} onChange={setRating} />
      <label className="block text-sm font-semibold">{t('form.text')}
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={REVIEW.maxText} placeholder={t('form.placeholder')} className={`${INPUT} mt-1 min-h-24 font-normal`} />
      </label>
      {err ? <Notice tone="err">{err}</Notice> : null}
      <button type="submit" disabled={!rating || busy} className={BTN_PRIMARY}>{busy ? t('form.sending') : t('form.submit')}</button>
    </form>
  );
}

/** Berilgan baho: yuk egasiga o'z bahosi, terminalga javob tugmasi (REVIEW.maxReplyDays ichida qayta yozish mumkin). */
function ReviewCard({ r, canReply, onReply }: { r: R; canReply: boolean; onReply: (r: R) => void }) {
  const locale = useLocale();
  const t = useTranslations('reviews');
  const te = useTranslations('reviews.err');
  const [editing, setEditing] = useState(false);
  const [reply, setReply] = useState(r.reply ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { onReply(await post<R>(`/reviews/${r.id}/reply`, { reply: reply.trim() })); setEditing(false); }
    catch (e) { setErr(errText(e, te, te.has, te('failed'))); } finally { setBusy(false); }
  }

  return (
    <div>
      <h3 className="font-semibold">{canReply ? t('review') : t('yours')}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Stars n={r.rating} className="text-base" />
        <span className="font-mono text-xs text-muted">{uzDate(r.createdAt, locale)}</span>
      </div>
      {r.text ? <p className="mt-2 whitespace-pre-line text-sm">{r.text}</p> : null}
      {r.reply && !editing ? (
        <div className="mt-3 rounded-xl bg-sand px-3 py-2 text-sm">
          <p className="text-xs font-semibold text-muted">{t('reply')}{r.repliedAt ? ` · ${uzDate(r.repliedAt, locale)}` : ''}</p>
          <p className="mt-0.5 whitespace-pre-line">{r.reply}</p>
        </div>
      ) : null}
      {canReply ? (
        editing ? (
          <form onSubmit={send} className="mt-3 space-y-2">
            <label className="block text-sm font-semibold">{t('replyForm.label')}
              <textarea autoFocus value={reply} onChange={(e) => setReply(e.target.value)} maxLength={REVIEW.maxText} className={`${INPUT} mt-1 min-h-24 font-normal`} />
            </label>
            {err ? <Notice tone="err">{err}</Notice> : null}
            <div className="flex gap-2">
              <button type="submit" disabled={!reply.trim() || busy} className={BTN_PRIMARY}>{busy ? t('replyForm.sending') : t('replyForm.submit')}</button>
              <button type="button" onClick={() => setEditing(false)} className={BTN_GHOST}>{t('replyForm.cancel')}</button>
            </div>
          </form>
        ) : (
          <div className="mt-3">
            <button type="button" onClick={() => setEditing(true)} className={BTN_GHOST}>{r.reply ? t('replyForm.edit') : t('replyForm.cta')}</button>
            <p className="mt-1 text-xs text-muted">{t('replyForm.hint')}</p>
          </div>
        )
      ) : null}
    </div>
  );
}
