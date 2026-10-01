'use client';
/**
 * Shikoyat tugmasi: e'lon, terminal, xizmat sahifasi, bozor so'rovi va kabinetdagi
 * buyurtma ostida.
 *
 * Ochiq forma emas, kichik havola-tugma: shikoyat kam uchraydigan amal va sahifaning
 * asosiy ishini (bog'lanish, taklif berish) ko'zdan qochirmasligi kerak.
 *
 * Sabab tanlagichi native select emas: brauzerning o'z oynasi dizayn tizimidan
 * tashqarida qoladi. Variantlar oltita (COPYRIGHT qo'shilgandan keyin) va ular
 * flex-wrap ichida yotadi: keng ekranda ikki qatorga, tor ekranda esa bir nechta
 * qatorga tushadi. Hech bir tugma o'rtadan sinmaydi, chunki eng uzun yorliq ham
 * 390px kenglikda bitta qatorga sig'adi. Shu sababli kod o'zgartirilmadi: ro'yxat
 * oynasi baribir kerak emas.
 *
 * Takroriy shikoyat serverda 409 bo'lib qaytadi (bazadagi noyoblik kaliti): bu yerda
 * oldindan "yuborganmisiz" so'rovi yo'q, sahifa bitta ham ortiqcha so'rov yubormaydi.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { WarningCircleIcon } from '@phosphor-icons/react';
import { REPORT, REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason, type ReportTarget } from '@yuksaroy/domain';
import { Link, usePathname } from '@/i18n/navigation';
import { ApiError, hasSession, post } from '@/lib/api';
import { useLang } from '@/components/kabinet/bits';

type State = 'idle' | 'form' | 'busy' | 'sent' | 'login' | 'already' | 'limit' | 'gone' | 'err';

export function ReportButton({ kind, targetId }: { kind: ReportTarget; targetId: string }) {
  const t = useTranslations('report');
  const lang = useLang();
  const next = usePathname();
  const [state, setState] = useState<State>('idle');
  const [reason, setReason] = useState<ReportReason>('WRONG');
  const [text, setText] = useState('');
  const L = REPORT_REASON_LABELS[lang];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    try {
      await post('/reports', { kind, id: targetId, reason, text: text.trim() });
      setState('sent');
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setState(status === 409 ? 'already' : status === 401 ? 'login' : status === 429 ? 'limit' : status === 404 ? 'gone' : 'err');
    }
  }

  if (state === 'sent') return <p className="text-sm font-semibold text-teal-ink">{t('sent')}</p>;
  if (state === 'already') return <p className="text-sm text-muted">{t('already')}</p>;
  if (state === 'login') {
    return (
      <p className="text-sm text-muted">
        {t('login')}{' '}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-teal-ink underline underline-offset-4">{t('loginCta')}</Link>
      </p>
    );
  }
  if (state === 'idle') {
    // Mehmonga darrov nima qilish kerakligi ko'rinsin: formani to'ldirib, keyin bilib o'tirmasin
    return (
      <button
        type="button" onClick={() => setState(hasSession() ? 'form' : 'login')}
        className="inline-flex items-center gap-1.5 text-sm text-muted underline underline-offset-4 transition-colors duration-150 hover:text-navy"
      >
        <WarningCircleIcon size={15} aria-hidden="true" />{t('open')}
      </button>
    );
  }

  const short = text.trim().length < REPORT.textMin;
  return (
    <form onSubmit={submit} className="max-w-xl rounded-card border border-line bg-white p-4">
      <p className="font-semibold text-navy">{t('title')}</p>
      <p className="mt-1 text-sm text-muted">{t('lead')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {REPORT_REASONS.map((r) => (
          <button
            key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150 ${reason === r ? 'bg-navy text-white' : 'border border-line bg-white text-muted hover:border-teal hover:text-ink'}`}
          >{L[r]}</button>
        ))}
      </div>
      <label className="mt-3 block text-xs font-semibold text-muted">{t('text')}
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={3} required
          minLength={REPORT.textMin} maxLength={REPORT.textMax}
          className="mt-1 w-full rounded-xl border border-field bg-white px-3 py-2 text-base font-normal text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/25"
        />
        <span className="mt-1 block text-[11px] font-normal">{t('textHint')}</span>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={state === 'busy' || short} className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white transition hover:bg-navy-2 disabled:opacity-60">
          {state === 'busy' ? t('sending') : t('submit')}
        </button>
        <button type="button" onClick={() => setState('idle')} className="rounded-full border border-line bg-white px-5 py-2 text-sm font-semibold transition hover:border-teal">{t('cancel')}</button>
      </div>
      {state === 'limit' ? <p role="alert" className="mt-2 text-sm text-amber-ink">{t('limit')}</p>
        : state === 'gone' ? <p role="alert" className="mt-2 text-sm text-amber-ink">{t('gone')}</p>
          : state === 'err' ? <p role="alert" className="mt-2 text-sm text-amber-ink">{t('err')}</p> : null}
    </form>
  );
}
