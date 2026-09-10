'use client';
// Ko'rsatkichlar: 30 kunlik ko'rsatishlar yuzalar bo'yicha (SVG ustunlar, kutubxonasiz), jami, so'rovlar, ko'rishlar yoki buyurtmalar. Faqat shu raqamlar.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { IMPRESSION_SURFACES, type ImpressionSurface } from '@yuksaroy/domain';
import { api } from '@/lib/api';
import { uzDate } from '@/lib/format';
import type { Analytics } from '@/lib/types-trust';

const COLOR: Record<ImpressionSurface, string> = { list: '#002352', map: '#077F84', detail: '#FD7B03', compare: '#05979E', bot: '#52677E', contact: '#1B8A5A' };
const W = 600, H = 128, PAD = 4, AXIS = 4; // sana yorliqlari SVG tashqarisida (390 da o'qiladigan bo'lsin)
const sum = (d: Record<ImpressionSurface, number>) => IMPRESSION_SURFACES.reduce((s, k) => s + d[k], 0);

export function AnalyticsPanel({ path, kind }: { path: string; kind: 'listing' | 'terminal' }) {
  const t = useTranslations('analytics');
  const [a, setA] = useState<Analytics | null | undefined>(undefined);
  useEffect(() => { setA(undefined); api<Analytics>(path).then(setA).catch(() => setA(null)); }, [path]);
  if (a === undefined) return <p className="text-sm text-muted">{t('loading')}</p>;
  if (a === null) return <p role="alert" className="text-sm text-red-700">{t('loadFailed')}</p>;

  const max = Math.max(1, ...a.days.map(sum));
  const bw = (W - PAD * 2) / Math.max(1, a.days.length);
  const tiles: [string, number][] = [
    [t('total'), a.totals.all],
    [t('inquiries'), a.inquiries],
    kind === 'listing' ? [t('views'), a.views ?? 0] : [t('orders'), a.orders ?? 0],
  ];
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t(kind === 'listing' ? 'leadListing' : 'leadTerminal')}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-card border border-line bg-white px-4 py-3">
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1 font-display text-2xl font-bold text-navy tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <div className="rounded-card border border-line bg-white p-4">
        {a.totals.all === 0 ? <p className="text-sm text-muted">{t('empty')}</p> : null}
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('chartAria')} className="mt-2 h-32 w-full">
          {a.days.map((d, i) => {
            const x = PAD + i * bw + 1, w = Math.max(1, bw - 2), total = sum(d);
            let y = H - AXIS;
            return (
              <g key={d.day}>
                <title>{t('dayTitle', { day: uzDate(d.day), n: total })}</title>
                {total === 0 ? <rect x={x} y={H - AXIS - 2} width={w} height={2} fill="#DCE4EC" /> : null}
                {IMPRESSION_SURFACES.map((k) => {
                  if (!d[k]) return null;
                  const h = (d[k] / max) * (H - AXIS - 8);
                  y -= h;
                  return <rect key={k} x={x} y={y} width={w} height={h} fill={COLOR[k]} />;
                })}
              </g>
            );
          })}
        </svg>
        <div className="flex justify-between font-mono text-[10px] text-muted">
          {[0, 14, 29].map((i) => <span key={i}>{a.days[i] ? uzDate(a.days[i]!.day) : ''}</span>)}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
          {IMPRESSION_SURFACES.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[k] }} />
              {t(`surface.${k}`)} <span className="text-ink tabular-nums">{a.totals[k]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
