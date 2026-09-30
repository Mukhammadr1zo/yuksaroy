'use client';
// Slot grid (8.6): kun × oyna. Katak rang + raqam bilan o'qiladi (faqat rang emas, 8.8).
// Bo'sh joy: teal = bor, amber = 1 qoldi, kulrang = yo'q. Tanlangan katak teal ramka.
//
// Telefonda jadval o'rniga kun chiplari va tanlangan kunning oynalari ro'yxati chiqadi.
// Ikkala ko'rinish bitta HTML da turadi va faqat CSS (sm:) bilan almashadi: ekran
// kengligini JS bilan o'lchasak, server chizgan sahifa bilan mos kelmay, birinchi
// chizishdan keyin ko'rinish sakrab ketardi.
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { uzDayShort, uzTime } from '@/lib/format';
import type { Slot } from '@/lib/types';

const hhmm = uzTime;

export function SlotGrid({ slots, selectedId, onSelect, busy }: {
  slots: Slot[]; selectedId: string | null; onSelect: (s: Slot) => void; busy?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('dashboard2.order.slots');
  const [pick, setPick] = useState<string | null>(null);
  const dayLabel = (d: string) => uzDayShort(`${d}T06:00:00Z`, locale);
  const { days, windows, byKey, freeByDay } = useMemo(() => {
    const days = [...new Set(slots.map((s) => s.localDate))].sort();
    const windows = [...new Set(slots.map((s) => s.window))].sort((a, b) => a - b);
    const byKey = new Map(slots.map((s) => [`${s.localDate}|${s.window}`, s]));
    // Kun chipidagi son: shu kunning bo'sh joylari yig'indisi. Odam chipga qarab
    // qaysi kunni ochishini hal qiladi, shuning uchun son kerak.
    const freeByDay = new Map(days.map((d) => [d, 0]));
    for (const s of slots) if (s.status === 'OPEN' && s.free > 0) freeByDay.set(s.localDate, (freeByDay.get(s.localDate) ?? 0) + s.free);
    return { days, windows, byKey, freeByDay };
  }, [slots]);

  if (!slots.length) return <p className="rounded-card border border-dashed border-line p-6 text-sm text-muted">{t('empty')}</p>;

  const times = windows.map((w) => { const s = slots.find((x) => x.window === w); return s ? `${hhmm(s.startsAt)}-${hhmm(s.endsAt)}` : String(w); });
  // Katak ko'rinishi ikkala ko'rinishda bir xil bo'lsin: rang bitta joyda yoziladi
  const look = (s: Slot) => ({
    closed: s.status === 'CLOSED' || s.free <= 0,
    sel: s.id === selectedId,
    tone: s.status === 'CLOSED' || s.free <= 0 ? 'border-line bg-line/40 text-muted'
      : s.free === 1 ? 'border-amber/50 bg-amber-soft text-amber-ink hover:border-amber'
        : 'border-teal/40 bg-teal-soft text-teal-ink hover:border-teal',
  });
  // Ochiq kun: odam chip bosgan bo'lsa o'sha, bo'lmasa ushlangan slot kuni, u ham
  // bo'lmasa birinchi bo'sh joyi bor kun. Effekt emas, hisoblash: slotlar qayta
  // yuklanib kun ro'yxatdan chiqib ketsa, o'zi to'g'ri kunga qaytadi.
  const held = slots.find((s) => s.id === selectedId)?.localDate;
  const day = (pick && days.includes(pick) ? pick : null) ?? held ?? days.find((d) => (freeByDay.get(d) ?? 0) > 0) ?? days[0];

  return (
    <div>
      {/* Telefon: kun chiplari qatori, ostida shu kunning oynalari */}
      <div className="sm:hidden">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {days.map((d) => {
            const free = freeByDay.get(d) ?? 0;
            const on = d === day;
            return (
              <button
                key={d} type="button" onClick={() => setPick(d)} aria-pressed={on}
                className={`flex min-h-11 shrink-0 flex-col items-center justify-center rounded-xl border-2 px-3 py-1 transition ${on ? 'border-teal bg-teal-soft text-teal-ink' : free > 0 ? 'border-line bg-white' : 'border-line bg-line/40 text-muted'}`}
              >
                <span className="whitespace-nowrap text-xs font-semibold">{dayLabel(d)}</span>
                <span className="font-mono text-[11px] tabular-nums">{free > 0 ? t('dayFree', { n: free }) : t('busy')}</span>
              </button>
            );
          })}
        </div>
        <ul className="space-y-1.5">
          {windows.map((w, i) => {
            const s = byKey.get(`${day}|${w}`);
            if (!s) return null;
            const { closed, sel, tone } = look(s);
            return (
              <li key={w}>
                <button
                  type="button" disabled={closed || busy} onClick={() => onSelect(s)} aria-pressed={sel}
                  aria-label={`${dayLabel(day)} ${times[i]}, ${closed ? t('busy') : t('free', { n: s.free })}`}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-2 transition duration-200 disabled:cursor-not-allowed ${tone} ${sel ? 'ring-2 ring-teal ring-offset-1' : ''}`}
                >
                  <span className="font-mono text-sm tabular-nums">{times[i]}</span>
                  <span className="text-sm font-semibold">{closed ? t('busy') : t('free', { n: s.free })}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* sm: dan boshlab jadval. Kun ustuni yopishib turadi: olti oynada jadval kartaga
          sig'maydi va o'ngga surilganda qaysi kun ekani ko'rinmay qolardi. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[540px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-24 bg-white" aria-hidden="true" />
              {windows.map((w, i) => <th key={w} scope="col" className="pb-1 font-mono text-[11px] font-normal text-muted">{times[i]}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d}>
                <th scope="row" className="sticky left-0 z-10 bg-white pr-2 text-right text-xs font-semibold text-muted">{dayLabel(d)}</th>
                {windows.map((w, i) => {
                  const s = byKey.get(`${d}|${w}`);
                  if (!s) return <td key={w}><div className="h-11 rounded-lg bg-line/40" /></td>;
                  const { closed, sel, tone } = look(s);
                  return (
                    <td key={w}>
                      <button
                        type="button" disabled={closed || busy} onClick={() => onSelect(s)}
                        aria-pressed={sel}
                        aria-label={`${dayLabel(d)} ${times[i]}, ${closed ? t('busy') : t('free', { n: s.free })}`}
                        className={`h-11 w-full rounded-lg border-2 font-mono text-sm tabular-nums transition duration-200 disabled:cursor-not-allowed ${tone} ${sel ? 'ring-2 ring-teal ring-offset-1' : ''}`}
                      >
                        {closed ? '·' : s.free}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-teal" />{t('legendFree')}</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber" />{t('legendLast')}</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-line" />{t('legendBusy')}</span>
        </p>
      </div>
    </div>
  );
}
