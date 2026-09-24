'use client';
/**
 * Tasdiqdan keyingi birinchi qadam: ikki maydon.
 *
 * Yangi ega to'rtta yorliqli tahrirlagich oldida qoladi va odatda hech narsa qilmaydi.
 * Mijozga esa faqat ikki narsa kerak: qaysi ishni qilasiz va vagon boshiga qancha.
 * Shuning uchun shu ikkovi yuqorida turadi va ikkalasi qo'yilgach karta yo'qoladi.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, post } from '@/lib/api';
import type { MyTerminal } from '@/lib/types-kabinet';
import { BTN_PRIMARY, INPUT, Notice } from '@/components/kabinet/bits';

/** Faqat shu ikkovi: qolgan xizmatlar to'liq bo'limda. */
const WORK = ['LOAD', 'UNLOAD'] as const;

export function QuickOffer({ term }: { term: MyTerminal }) {
  const t = useTranslations('terminalsAdmin.quick');
  const ts = useTranslations('service');
  const tc = useTranslations('kabinet.common');
  const enabled = term.services.filter((s) => s.isEnabled).map((s) => s.serviceCode);
  const hasWork = WORK.some((w) => enabled.includes(w));
  const hasPrice = term.tariffs.some((x) => WORK.includes(x.serviceCode as (typeof WORK)[number]));
  const [code, setCode] = useState<(typeof WORK)[number]>(WORK.find((w) => enabled.includes(w)) ?? 'LOAD');
  const [som, setSom] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // Ikkovi ham bor: karta o'z ishini bajardi
  if (hasWork && hasPrice) return null;

  async function save() {
    const price = Number(som);
    if (!Number.isFinite(price) || price <= 0) return;
    setBusy(true); setNote(null);
    try {
      // Butun ro'yxat yuboriladi: server uni almashtiradi, qisman ro'yxat qolgan xizmatlarni o'chirardi
      const services = term.services.map((s) => ({ serviceCode: s.serviceCode, isEnabled: s.serviceCode === code ? true : s.isEnabled, leadTimeMin: s.leadTimeMin }));
      if (!services.some((s) => s.serviceCode === code)) services.push({ serviceCode: code, isEnabled: true, leadTimeMin: 0 });
      await api(`/terminals/${term.id}/services`, { method: 'PUT', body: JSON.stringify({ services }) });
      await post(`/terminals/${term.id}/tariffs`, { serviceCode: code, priceTiyin: Math.round(price * 100), unit: 'PER_WAGON' });
      setNote({ tone: 'ok', text: t('saved') });
    } catch { setNote({ tone: 'err', text: tc('failed') }); } finally { setBusy(false); }
  }

  return (
    <section className="rounded-card border border-teal/40 bg-teal-soft/40 p-5">
      <h2 className="font-semibold">{t('title')}</h2>
      <p className="mt-0.5 max-w-2xl text-sm text-muted">{t('lead')}</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-56">
          <span className="mb-1 block text-xs text-muted">{t('work')}</span>
          <select className={INPUT} value={code} onChange={(e) => setCode(e.target.value as (typeof WORK)[number])}>
            {WORK.map((w) => <option key={w} value={w}>{ts(w)}</option>)}
          </select>
        </label>
        <label className="w-full sm:w-56">
          <span className="mb-1 block text-xs text-muted">{t('price')}</span>
          <input inputMode="numeric" maxLength={10} className={`${INPUT} font-mono`} value={som}
            onChange={(e) => setSom(e.target.value.replace(/[^0-9]/g, ''))} />
        </label>
        <button type="button" disabled={busy || !som} onClick={() => void save()} className={BTN_PRIMARY}>{busy ? tc('saving') : tc('save')}</button>
      </div>
      {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      <p className="mt-3 text-xs text-muted">{t('slotHint')}</p>
    </section>
  );
}
