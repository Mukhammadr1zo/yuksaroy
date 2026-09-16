'use client';
/**
 * Moderatsiya qarori: tasdiqlash darhol, rad etish sabab bilan.
 * `path` ga { approve, [reasonKey]: text } yuboriladi. Rad etishda sabab har doim
 * majburiy: u auditga yoziladi va egasi nimani tuzatishni bilishi kerak. Ilgari
 * da'volarda ixtiyoriy edi va rad etilgan tashkilot sababsiz qolardi.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { post } from '@/lib/api';
import { BTN, BTN_DANGER, BTN_GHOST, INPUT } from '@/components/admin/kit';

export type Decision = 'approved' | 'rejected';

export function Decide({ path, reasonKey, requireReason, onDone }: {
  path: string; reasonKey: 'reason' | 'note'; requireReason: boolean; onDone?: (d: Decision) => void;
}) {
  const t = useTranslations('admin');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Decision | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function send(approve: boolean) {
    setBusy(true); setErr(null);
    try {
      await post(path, { approve, [reasonKey]: reason.trim() || undefined });
      const d: Decision = approve ? 'approved' : 'rejected';
      setDone(d);
      onDone?.(d);
    } catch { setErr(t('failed')); } finally { setBusy(false); }
  }

  // Qator ro'yxatda qolsa (onDone yo'q) natija shu yerda ko'rinadi
  if (done) return <p className={`mt-3 text-sm font-semibold ${done === 'approved' ? 'text-teal-ink' : 'text-red-700'}`}>{t(`decided.${done}`)}</p>;
  return (
    <div className="mt-3">
      {rejecting ? (
        <div className="space-y-2">
          <label className="block text-sm font-semibold">{requireReason ? t('reason') : t('note')}
            <textarea autoFocus rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={`${INPUT} mt-1 font-normal`} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || (requireReason && !reason.trim())} onClick={() => send(false)} className={`${BTN_DANGER} border-red-400 bg-red-600 text-white hover:bg-red-700`}>{busy ? t('busy') : t('confirmReject')}</button>
            <button type="button" onClick={() => setRejecting(false)} className={BTN_GHOST}>{t('cancel')}</button>
          </div>
          {requireReason && !reason.trim() ? <p className="text-xs text-muted">{t('reasonRequired')}</p> : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => send(true)} className={BTN}>{busy ? t('busy') : t('approve')}</button>
          <button type="button" disabled={busy} onClick={() => setRejecting(true)} className={BTN_DANGER}>{t('reject')}</button>
        </div>
      )}
      {err ? <p role="alert" className="mt-2 text-sm text-red-700">{err}</p> : null}
    </div>
  );
}
