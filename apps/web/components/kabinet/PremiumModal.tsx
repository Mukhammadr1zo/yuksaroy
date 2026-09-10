'use client';
// Premium buyurtma: oylar (1..12), jami so'm, POST /listings/:id/premium, keyin to'lov ko'rsatmasi. Tashqarini bosish yoki Esc yopadi.
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PRICING, premiumAmountTiyin } from '@yuksaroy/domain';
import { post } from '@/lib/api';
import { som } from '@/lib/format';
import type { PremiumCreated } from '@/lib/types-trust';
import { BTN_GHOST, BTN_PRIMARY, INPUT, Notice } from './bits';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function PremiumModal({ listing, onClose }: { listing: { id: string; title: string }; onClose: () => void }) {
  const t = useTranslations('premium.modal');
  const locale = useLocale();
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [res, setRes] = useState<PremiumCreated | null>(null);

  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  // Fokus qamovi: ochilganda birinchi elementga, Tab modal ichida aylanadi, yopilganda chaqirgan tugmaga qaytadi
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const items = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select, input, textarea, [tabindex]:not([tabindex="-1"])') ?? []);
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close.current(); return; }
      if (e.key !== 'Tab') return;
      const f = items();
      if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      const cur = document.activeElement;
      const out = !panel.current?.contains(cur);
      if (e.shiftKey ? out || cur === first : out || cur === last) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus(); };
  }, []);

  // Muvaffaqiyatdan keyin forma o'rnini xabar egallaydi: fokus yopish tugmasiga o'tsin
  useEffect(() => { if (res) panel.current?.querySelector('button')?.focus(); }, [res]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(false);
    try { setRes(await post<PremiumCreated>(`/listings/${listing.id}/premium`, { months })); }
    catch { setErr(true); } finally { setBusy(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="premium-title" onClick={onClose} className="fixed inset-0 z-40 flex items-end justify-center bg-navy/40 p-4 sm:items-center">
      <div ref={panel} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-card border border-line bg-white p-6">
        <h2 id="premium-title" className="text-lg font-bold">{t('title', { title: listing.title })}</h2>
        {res ? (
          <div className="mt-3 space-y-3 text-sm">
            <Notice tone="ok">{t('created')}</Notice>
            <dl className="space-y-1">
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('orderNo')}</dt><dd className="font-mono">{res.order.id}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('amount')}</dt><dd className="font-mono font-semibold tabular-nums">{som(res.order.amountTiyin, locale)}</dd></div>
            </dl>
            <div>
              <p className="text-xs font-semibold text-muted">{t('pay')}</p>
              <p className="mt-1 whitespace-pre-line rounded-xl bg-sand p-3">{res.payInstructions.details}</p>
            </div>
            <p className="text-xs text-muted">{t('afterPay')}</p>
            <button type="button" onClick={onClose} className={BTN_PRIMARY}>{t('close')}</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-4">
            <p className="text-sm text-muted">{t('lead')}</p>
            <label className="block text-sm font-semibold">{t('months')}
              <select autoFocus value={months} onChange={(e) => setMonths(Number(e.target.value))} className={`${INPUT} mt-1 font-mono`}>
                {MONTHS.map((n) => <option key={n} value={n}>{t('month', { n })}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-sand px-4 py-3">
              <span className="font-mono text-sm text-muted tabular-nums">{t('perMonth', { price: som(PRICING.premiumPerListingPerMonthSom * 100, locale) })}</span>
              <span className="font-mono text-lg font-bold text-navy tabular-nums">{t('total')}: {som(premiumAmountTiyin(months))}</span>
            </div>
            {err ? <Notice tone="err">{t('failed')}</Notice> : null}
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={BTN_PRIMARY}>{busy ? t('sending') : t('submit')}</button>
              <button type="button" onClick={onClose} className={BTN_GHOST}>{t('cancel')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
