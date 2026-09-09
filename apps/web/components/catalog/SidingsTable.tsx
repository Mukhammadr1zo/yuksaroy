import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { num } from '@/lib/format';
import type { Siding } from '@/lib/types';

/** Shahobcha yo'llar jadvali: reestr sahifasi va viloyat hubi bir xil qatorlarni ko'rsatadi. */
export async function SidingsTable({ items }: { items: Siding[] }) {
  const [t, tc, tr] = await Promise.all([getTranslations('sidings'), getTranslations('common'), getTranslations('region')]);
  const region = (code: string | null) => (code && tr.has(code) ? tr(code) : '·');
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-white">
      <table className="w-full text-sm">
        <thead className="bg-sand text-left font-mono text-xs text-muted">
          <tr><th className="px-4 py-2">{t('col.no')}</th><th className="px-4 py-2">{t('col.location')}</th><th className="px-4 py-2">{tc('region')}</th><th className="px-4 py-2 text-right">{t('col.length')}</th><th className="px-4 py-2 text-right">{t('col.capacity')}</th><th className="px-4 py-2">{t('col.owner')}</th></tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="border-t border-line/70">
              <td className="px-4 py-2 font-mono text-xs"><Link href={`/sidings/${s.id}`} className="text-navy underline decoration-dotted hover:text-teal-ink">{s.registryNo}</Link></td>
              <td className="px-4 py-2 font-semibold"><Link href={`/sidings/${s.id}`} className="hover:text-teal-ink">{s.station?.nameUz ?? s.stationNameRaw}</Link></td>
              <td className="px-4 py-2 text-xs text-muted">{region(s.regionCode)}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">{s.lengthM ? `${num(s.lengthM)} ${tc('unit.meter')}` : '·'}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">{s.unloadCapacity} / {s.loadCapacity} {tc('unit.wagonShort')}</td>
              <td className="px-4 py-2 text-xs">
                {s.claimStatus === 'APPROVED' ? <span className="font-semibold text-teal-ink">{s.owner}</span>
                  : s.claimStatus === 'PENDING' ? <span className="text-amber">{t('owner.pending')}</span>
                  : <Link href="/login" className="text-muted underline decoration-dotted hover:text-navy">{t('owner.unclaimed')}</Link>}
              </td>
            </tr>
          ))}
          {items.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">{t('empty')}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
