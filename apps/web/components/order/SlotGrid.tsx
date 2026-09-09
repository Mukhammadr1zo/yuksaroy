'use client';
// Slot grid (8.6): kun × oyna. Katak rang + raqam bilan o'qiladi (faqat rang emas, 8.8).
// Bo'sh joy: teal = bor, amber = 1 qoldi, kulrang = yo'q. Tanlangan katak teal ramka.
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { uzDayShort, uzTime } from '@/lib/format';
import type { Slot } from '@/lib/types';

const hhmm = uzTime;

export function SlotGrid({ slots, selectedId, onSelect, busy }: {
  slots: Slot[]; selectedId: string | null; onSelect: (s: Slot) => void; busy?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('dashboard2.order.slots');
  const dayLabel = (d: string) => uzDayShort(`${d}T06:00:00Z`, locale);
  const { days, windows, byKey } = useMemo(() => {
    const days = [...new Set(slots.map((s) => s.localDate))].sort();
    const windows = [...new Set(slots.map((s) => s.window))].sort((a, b) => a - b);
    const byKey = new Map(slots.map((s) => [`${s.localDate}|${s.window}`, s]));
    return { days, windows, byKey };
  }, [slots]);

  if (!slots.length) return <p className="rounded-card border border-dashed border-line p-6 text-sm text-muted">{t('empty')}</p>;

  const times = windows.map((w) => { const s = slots.find((x) => x.window === w); return s ? `${hhmm(s.startsAt)}-${hhmm(s.endsAt)}` : String(w); });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-24" />
            {windows.map((w, i) => <th key={w} className="pb-1 font-mono text-[11px] font-normal text-muted">{times[i]}</th>)}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d}>
              <th scope="row" className="pr-2 text-right text-xs font-semibold text-muted">{dayLabel(d)}</th>
              {windows.map((w) => {
                const s = byKey.get(`${d}|${w}`);
                if (!s) return <td key={w}><div className="h-11 rounded-lg bg-line/40" /></td>;
                const free = s.free, closed = s.status === 'CLOSED' || free <= 0;
                const sel = s.id === selectedId;
                const tone = closed ? 'border-line bg-line/40 text-muted' : free === 1 ? 'border-amber/50 bg-amber-soft text-amber-ink hover:border-amber' : 'border-teal/40 bg-teal-soft text-teal-ink hover:border-teal';
                return (
                  <td key={w}>
                    <button
                      type="button" disabled={closed || busy} onClick={() => onSelect(s)}
                      aria-pressed={sel}
                      aria-label={`${dayLabel(d)} ${times[windows.indexOf(w)]}, ${closed ? t('busy') : t('free', { n: free })}`}
                      className={`h-11 w-full rounded-lg border-2 font-mono text-sm tabular-nums transition duration-200 disabled:cursor-not-allowed ${tone} ${sel ? 'ring-2 ring-teal ring-offset-1' : ''}`}
                    >
                      {closed ? '·' : free}
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
  );
}
