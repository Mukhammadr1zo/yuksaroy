'use client';
// Slotlar: sig'im ochish (PUT /terminals/:id/capacity) va keyingi 14 kun jadvali (GET slots, POST slots/:slotId/close).
// Katak: bo'sh joy soni, kichik raqam band + ushlangan. Bosish slotni yopadi yoki ochadi, keyin jadval qayta yuklanadi.
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BOOKING } from '@yuksaroy/domain';
import { api, post } from '@/lib/api';
import { uzDayShort, uzTime, uzToday } from '@/lib/format';
import type { Slot } from '@/lib/types';
import { BTN_GHOST, BTN_PRIMARY, INPUT, Notice, errText } from '@/components/kabinet/bits';

type Win = { window: number; start: string; end: string; capacity: number };
const plusDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const defaultWindows = (): Win[] => BOOKING.defaultWindows.map(([start, end], i) => ({ window: i + 1, start, end, capacity: BOOKING.defaultCapacity }));
const SMALL = 'rounded-lg border border-line bg-white px-2 py-1 font-mono text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/25';

export function SlotsTab({ terminalId }: { terminalId: string | null }) {
  const t = useTranslations('terminalsAdmin.slots');
  const te = useTranslations('terminalsAdmin.slots.err');
  const tc = useTranslations('kabinet.common');
  const today = uzToday();
  const [cap, setCap] = useState({ from: today, to: plusDays(today, 13), weekdaysOnly: false, windows: defaultWindows() });
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const setW = (i: number, p: Partial<Win>) => setCap((c) => ({ ...c, windows: c.windows.map((w, j) => (j === i ? { ...w, ...p } : w)) }));

  const load = useCallback(() => {
    if (!terminalId) return;
    api<Slot[]>(`/terminals/${terminalId}/slots?from=${today}&to=${plusDays(today, 13)}`).then(setSlots).catch(() => setErr(true));
  }, [terminalId, today]);
  useEffect(() => { void load(); }, [load]);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!terminalId) return;
    setBusy('cap'); setNotice(null);
    try {
      const r = await api<{ slots: number; days: number; windows: number }>(`/terminals/${terminalId}/capacity`, { method: 'PUT', body: JSON.stringify(cap) });
      setNotice({ tone: 'ok', text: t('capacity.applied', { days: r.days, windows: r.windows, slots: r.slots }) }); load();
    } catch (e) { setNotice({ tone: 'err', text: errText(e, te, te.has, tc('failed')) }); } finally { setBusy(null); }
  }

  async function toggle(s: Slot) {
    if (!terminalId) return;
    setBusy(s.id); setNotice(null);
    try { await post(`/terminals/${terminalId}/slots/${s.id}/close`, { closed: s.status === 'OPEN' }); load(); }
    catch (e) { setNotice({ tone: 'err', text: errText(e, te, te.has, tc('failed')) }); } finally { setBusy(null); }
  }

  const days = Array.from({ length: 14 }, (_, i) => plusDays(today, i));
  const windows = [...new Set((slots ?? []).map((s) => s.window))].sort((a, b) => a - b);
  const byKey = new Map((slots ?? []).map((s) => [`${s.localDate}|${s.window}`, s]));
  const timeOf = (w: number) => { const s = (slots ?? []).find((x) => x.window === w); return s ? `${uzTime(s.startsAt)}-${uzTime(s.endsAt)}` : String(w); };
  const dayLabel = (d: string) => uzDayShort(`${d}T06:00:00Z`);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('lead')}</p>

      <form onSubmit={apply} className="space-y-4 rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('capacity.title')}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm font-semibold">{t('capacity.from')}<input type="date" className={`${INPUT} mt-1 font-mono sm:w-44`} min={today} value={cap.from} onChange={(e) => setCap((c) => ({ ...c, from: e.target.value }))} /></label>
          <label className="block text-sm font-semibold">{t('capacity.to')}<input type="date" className={`${INPUT} mt-1 font-mono sm:w-44`} min={cap.from || today} value={cap.to} onChange={(e) => setCap((c) => ({ ...c, to: e.target.value }))} /></label>
          <label className="flex items-center gap-2 pb-3 text-sm font-semibold"><input type="checkbox" checked={cap.weekdaysOnly} onChange={(e) => setCap((c) => ({ ...c, weekdaysOnly: e.target.checked }))} className="h-4 w-4 accent-teal" />{t('capacity.weekdaysOnly')}</label>
        </div>
        <div>
          <p className="text-sm font-semibold">{t('capacity.windows')}</p>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-[420px] text-sm">
              <thead className="text-left text-xs text-muted"><tr><th className="pb-1 pr-3 font-normal">{t('capacity.window')}</th><th className="pb-1 pr-3 font-normal">{t('capacity.start')}</th><th className="pb-1 pr-3 font-normal">{t('capacity.end')}</th><th className="pb-1 pr-3 font-normal">{t('capacity.cap')}</th><th /></tr></thead>
              <tbody>
                {cap.windows.map((w, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-3 font-mono text-muted">{w.window}</td>
                    <td className="py-1 pr-3"><input type="time" aria-label={t('capacity.start')} value={w.start} onChange={(e) => setW(i, { start: e.target.value })} className={SMALL} /></td>
                    <td className="py-1 pr-3"><input type="time" aria-label={t('capacity.end')} value={w.end} onChange={(e) => setW(i, { end: e.target.value })} className={SMALL} /></td>
                    <td className="py-1 pr-3"><input type="number" aria-label={t('capacity.cap')} min={0} max={100} value={w.capacity} onChange={(e) => setW(i, { capacity: Math.max(0, Number(e.target.value) || 0) })} className={`${SMALL} w-20`} /></td>
                    <td className="py-1"><button type="button" onClick={() => setCap((c) => ({ ...c, windows: c.windows.filter((_, j) => j !== i).map((x, j) => ({ ...x, window: j + 1 })) }))} className="text-xs text-red-700 underline">x</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cap.windows.length < 24 ? (
            <button type="button" onClick={() => setCap((c) => { const last = c.windows[c.windows.length - 1]; const start = last?.end ?? '08:00'; const h = Number(start.slice(0, 2)); const end = h >= 22 ? '23:59' : `${String(h + 2).padStart(2, '0')}${start.slice(2)}`; return { ...c, windows: [...c.windows, { window: c.windows.length + 1, start, end, capacity: BOOKING.defaultCapacity }] }; })} className={`${BTN_GHOST} mt-2`}>{t('capacity.addWindow')}</button>
          ) : null}
        </div>
        <p className="text-xs text-muted">{t('capacity.hint')}</p>
        {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
        <button type="submit" disabled={busy !== null || !terminalId} className={BTN_PRIMARY}>{busy === 'cap' ? tc('saving') : t('capacity.apply')}</button>
      </form>

      <section className="rounded-card border border-line bg-white p-5">
        <h2 className="font-semibold">{t('grid.title')}</h2>
        {err ? <p role="alert" className="mt-2 text-sm text-red-700">{tc('loadFailed')}</p> : null}
        {terminalId && !slots && !err ? <p className="mt-2 text-sm text-muted">{tc('loading')}</p> : null}
        {!terminalId || slots?.length === 0 ? <p className="mt-2 text-sm text-muted">{t('grid.empty')}</p> : null}
        {slots?.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-1">
              <thead>
                <tr><th className="w-24" />{windows.map((w) => <th key={w} className="pb-1 font-mono text-[11px] font-normal text-muted">{timeOf(w)}</th>)}</tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d}>
                    <th scope="row" className="pr-2 text-right text-xs font-semibold text-muted">{dayLabel(d)}</th>
                    {windows.map((w) => {
                      const s = byKey.get(`${d}|${w}`);
                      if (!s) return <td key={w}><div className="h-12 rounded-lg bg-line/30" /></td>;
                      const closed = s.status === 'CLOSED';
                      const tone = closed ? 'border-line bg-line/50 text-muted line-through' : s.free === 0 ? 'border-amber/50 bg-amber-soft text-amber-ink' : 'border-teal/40 bg-teal-soft text-teal-ink';
                      return (
                        <td key={w}>
                          <button
                            type="button" disabled={busy !== null} onClick={() => toggle(s)}
                            title={closed ? t('grid.open') : t('grid.close')}
                            aria-label={`${t('grid.cell', { day: dayLabel(d), time: timeOf(w), free: s.free, booked: s.booked, held: s.held })}${closed ? `, ${t('grid.closed')}` : ''}`}
                            className={`h-12 w-full rounded-lg border-2 font-mono tabular-nums transition hover:border-navy disabled:cursor-wait ${tone}`}
                          >
                            <span className="block text-sm font-semibold">{closed ? '·' : s.free}</span>
                            {s.booked + s.held > 0 ? <span className="block text-[10px] leading-none">{s.booked}+{s.held}</span> : null}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
              <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-teal" />{t('grid.free')}</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber" />{t('grid.booked')} + {t('grid.held')}</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-line" />{t('grid.closed')}</span>
              <span>{t('grid.legend')}</span>
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
