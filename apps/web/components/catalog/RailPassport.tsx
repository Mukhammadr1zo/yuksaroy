import { getLocale, getTranslations } from 'next-intl/server';
import { num } from '@/lib/format';
import type { RailPassport } from '@/lib/types';

/**
 * Temir yo'l terminalining (shahobcha yo'lining) texnik pasporti: O'TY Taminot reestridagi
 * hamma maydon. Bo'sh maydon chizilmaydi, aks holda jadval yolg'on to'liqlik ko'rsatardi.
 * Mas'ul shaxs raqami faqat kirgan foydalanuvchiga keladi (API uni null qilib yuboradi).
 */
export async function RailPassportCard({ rail }: { rail: RailPassport }) {
  const locale = await getLocale();
  const t = await getTranslations('claim');
  const m = (v: number | null) => (v == null ? null : t('meters', { count: num(v, locale) }));
  const w = (v: number | null) => (v ? t('wagons', { count: v }) : null);
  const loco = rail.locoType === 'RAILWAY' ? t('locoRailway') : rail.locoType === 'PRIVATE' ? t('locoPrivate') : null;
  const term = rail.contractStart && rail.contractEnd
    ? `${rail.contractStart.slice(0, 10)} - ${rail.contractEnd.slice(0, 10)}`
    : rail.contractEnd?.slice(0, 10) ?? null;

  // Egasi so'radi: ulanish strelkasi, bashmaklar soni, guvohnoma raqami va temir yo'l
  // bo'limi olib tashlandi. Bular reestrning ichki maydonlari va yuk yubormoqchi bo'lgan
  // odamga hech narsa bermaydi; qaror uchun kerakligi yuqorida turibdi.
  const rows: [string, React.ReactNode][] = ([
    [t('registryNo'), rail.registryNo ?? rail.registryRef],
    [t('length'), m(rail.lengthM)],
    [t('tracks'), rail.trackCount],
    [t('load'), w(rail.loadCapacity)],
    [t('unload'), w(rail.unloadCapacity)],
    [t('capacity'), w(rail.capacityWagons)],
    [t('deadEnd'), m(rail.deadEndDistanceM)],
    [t('loco'), loco ?? rail.locoNote],
    [t('processing'), rail.processingHours ? t('hours', { count: rail.processingHours }) : null],
    [t('loadNorm'), rail.loadNorm],
    [t('unloadNorm'), rail.unloadNorm],
    [t('loadFront'), rail.loadFront],
    [t('unloadFront'), rail.unloadFront],
    [t('nogabarit'), rail.nogabarit],
    [t('equipment'), rail.equipment],
    [t('contractTerm'), term],
    [t('esr'), rail.esrCode],
  ] as [string, React.ReactNode][]).filter(([, v]) => v !== null && v !== undefined && v !== '');

  return (
    <section>
      <h2 className="text-lg font-bold">{t('passport')}</h2>
      <p className="mt-1 text-sm text-muted">{t('source')}</p>
      <dl className="mt-3 overflow-hidden rounded-card border border-line bg-white">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 border-t border-line/70 px-4 py-2.5 text-sm first:border-t-0">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-mono font-semibold tabular-nums text-navy">{v}</dd>
          </div>
        ))}
      </dl>

      {/* Mas'ul shaxs: ism ochiq. Raqam sahifa boshidagi tugma orqali, obunachiga (PhoneReveal). */}
      {rail.contactName || rail.hasPhone ? (
        <div className="mt-4 rounded-card border border-line bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('contactHeading')}</h3>
          {rail.contactName ? <p className="mt-1.5 font-semibold text-navy">{rail.contactName}</p> : null}
          <p className="mt-3 border-t border-line/70 pt-2 text-[11px] text-muted">{t('contactNote')}</p>
        </div>
      ) : null}

      {rail.ownerNameRaw ? (
        <p className="mt-3 break-words text-sm text-muted">{t('registryOwner')}: <span className="font-semibold text-ink">{rail.ownerNameRaw}</span></p>
      ) : null}
      {rail.note ? <p className="mt-2 text-sm text-muted">{t('note')}: {rail.note}</p> : null}
    </section>
  );
}
