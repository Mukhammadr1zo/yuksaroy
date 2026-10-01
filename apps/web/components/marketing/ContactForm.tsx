'use client';
// Murojaat formasi: POST /contact. "website" maydoni honeypot: odam ko'rmaydi, bot to'ldirsa API jimgina qabul qiladi.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircleIcon } from '@phosphor-icons/react';
import { post } from '@/lib/api';
import { BTN } from './bits';

// Mavzu serverda erkin matn (contact.controller.ts: @Length(1, 40)), ya'ni yangi mavzu
// qo'shish uchun API o'zgarmaydi. Tartib ekranda ko'ringan tartib: avval savol va nosozlik,
// keyin pul va hisob, oxirida hamkorlik taklifi.
const TOPICS = ['demo', 'question', 'tech', 'refund', 'badphone', 'phone', 'account', 'data', 'copyright', 'partner'] as const;
type Topic = (typeof TOPICS)[number];
const INPUT = 'mt-1 w-full rounded-xl border border-field bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/25';

// text: ochilgan raqam ishlamaganda PhoneReveal havolasi xabarni oldindan qo'yadi
export function ContactForm({ topic, text }: { topic?: string; text?: string }) {
  const t = useTranslations('contact');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'err' | 'rate'>('idle');
  const initial: Topic = TOPICS.includes(topic as Topic) ? (topic as Topic) : 'question';

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(['name', 'contact', 'topic', 'message', 'website'].map((k) => [k, String(f.get(k) ?? '').trim()]));
    setState('busy');
    try {
      await post('/contact', body);
      setState('sent');
    } catch (err: any) { setState(err?.status === 429 ? 'rate' : 'err'); }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-card border border-teal/40 bg-teal-soft p-6">
        <p className="flex items-center gap-2 font-display text-lg font-bold text-teal-ink"><CheckCircleIcon size={22} weight="fill" aria-hidden="true" />{t('success.title')}</p>
        <p className="mt-2 text-sm text-ink/85">{t('success.body')}</p>
        <button type="button" onClick={() => setState('idle')} className="mt-4 text-sm font-semibold text-teal-ink underline">{t('success.again')}</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-card border border-line bg-white p-6">
      <label className="block text-xs font-semibold text-muted">{t('form.name')}
        <input name="name" required minLength={2} maxLength={100} autoComplete="name" className={INPUT} />
      </label>
      <label className="block text-xs font-semibold text-muted">{t('form.contact')}
        <input name="contact" required minLength={3} maxLength={120} autoComplete="tel email" className={INPUT} />
        <span className="mt-1 block text-[11px] font-normal">{t('form.contactHint')}</span>
      </label>
      <label className="block text-xs font-semibold text-muted">{t('form.topic')}
        <select name="topic" defaultValue={initial} className={INPUT}>
          {TOPICS.map((k) => <option key={k} value={k}>{t(`form.topics.${k}`)}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-muted">{t('form.message')}
        <textarea name="message" defaultValue={text} required minLength={10} maxLength={2000} rows={5} className={INPUT} />
        <span className="mt-1 block text-[11px] font-normal">{t('form.messageHint')}</span>
      </label>
      {/* Honeypot: ekrandan tashqarida, tab bilan yetib bo'lmaydi */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <button disabled={state === 'busy'} className={`${BTN.primary} w-full disabled:opacity-60 sm:w-auto`}>{state === 'busy' ? t('form.sending') : t('form.submit')}</button>
      {state === 'err' || state === 'rate' ? <p className="text-sm text-amber-ink">{t(state === 'rate' ? 'error.rate' : 'error.generic')}</p> : null}
    </form>
  );
}
