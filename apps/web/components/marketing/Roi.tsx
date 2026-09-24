'use client';
// ROI hisoblagichlar: faqat brauzerda, formula ochiq. Raqamlar foydalanuvchiniki, platforma hech narsani kafolatlamaydi.
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatSom } from '@yuksaroy/domain';

const som = (v: number) => formatSom(Math.round(v) * 100);
const INPUT = 'mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 font-mono text-base font-normal text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/25';

function Field({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block text-xs font-semibold text-muted">
      {label}
      <input type="number" inputMode="numeric" min={0} className={INPUT} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
    </label>
  );
}

/** Natija kartasi: qatorlar (oxirgisi katta), izoh, "qanday hisoblandi" formulasi, ogohlantirish. */
function Result({ rows, sub, formula }: { rows: [string, string, boolean?][]; sub: string; formula: string }) {
  const tc = useTranslations('marketing.common');
  return (
    <div className="rounded-card bg-navy p-6 text-white">
      <dl className="space-y-4">
        {rows.map(([k, v, big]) => (
          <div key={k}>
            <dt className="text-sm text-white/70">{k}</dt>
            <dd className={`mt-1 tabular-nums ${big ? 'font-display text-[clamp(1.4rem,6vw,2.25rem)] font-bold leading-tight' : 'font-mono text-lg font-semibold'}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-sm text-white/70">{sub}</p>
      <p className="mt-5 border-t border-white/15 pt-4 text-xs font-semibold text-white/60">{tc('how')}</p>
      <p className="mt-1 font-mono text-xs leading-relaxed text-white/85">{formula}</p>
      <p className="mt-3 text-xs text-white/55">{tc('disclaimer')}</p>
    </div>
  );
}

const SHIPPER_KEYS = ['wagonDay', 'daysSaved', 'orders', 'hours', 'rate'] as const;
/** Yuk egasi: yillik tejam = 12 × buyurtmalar × (kun × vagon-kun + soat × soat narxi). */
export function ShipperRoi() {
  const t = useTranslations('marketing.shippers.roi');
  const [v, set] = useState({ wagonDay: 150000, daysSaved: 1, orders: 8, hours: 2, rate: 50000 });
  const perOrder = v.daysSaved * v.wagonDay + v.hours * v.rate;
  const yearly = 12 * v.orders * perOrder;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="grid content-start gap-4 sm:grid-cols-2">
        {SHIPPER_KEYS.map((k) => <Field key={k} label={t(`fields.${k}`)} value={v[k]} onChange={(n) => set({ ...v, [k]: n })} />)}
      </div>
      <Result rows={[[t('result'), som(yearly), true]]} sub={t('perOrder', { amount: som(perOrder) })} formula={t('formula')} />
    </div>
  );
}

// ponytail: e'lon boshiga oylik qo'shimcha buyurtma; real ko'rsatkich yig'ilgach shu jadval almashadi
const DEMAND = { low: 1, mid: 2, high: 4 } as const;
type Demand = keyof typeof DEMAND;
/**
 * Xizmat ko'rsatuvchi: yillik daromad = 12 x e'lonlar x talab x o'rtacha summa, minus obuna narxi.
 * Xarajat e'lon soniga ko'paytirilmaydi: bitta obuna barcha e'lonlarni qamraydi (ilgari
 * Premium har e'longa alohida sotilardi va hisob e'lon soniga bog'liq edi).
 */
export function ProviderRoi({ pricePerMonthSom }: { pricePerMonthSom: number }) {
  const t = useTranslations('marketing.providers.roi');
  const [listings, setListings] = useState(3);
  const [avg, setAvg] = useState(2500000);
  const [demand, setDemand] = useState<Demand>('mid');
  const price = pricePerMonthSom;
  const gross = 12 * listings * DEMAND[demand] * avg;
  const cost = 12 * price;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="grid content-start gap-4 sm:grid-cols-2">
        <Field label={t('fields.listings')} value={listings} onChange={setListings} />
        <Field label={t('fields.avgValue')} value={avg} onChange={setAvg} />
        <fieldset className="sm:col-span-2">
          <legend className="text-xs font-semibold text-muted">{t('demand.label')}</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {(Object.keys(DEMAND) as Demand[]).map((d) => (
              <label key={d} className={`has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal has-[:focus-visible]:outline-offset-2 cursor-pointer rounded-xl border px-3 py-2 text-center text-sm font-semibold transition ${demand === d ? 'border-teal bg-teal-soft text-teal-ink' : 'border-line bg-white text-ink/80 hover:border-teal'}`}>
                <input type="radio" name="demand" className="sr-only" checked={demand === d} onChange={() => setDemand(d)} />
                {t(`demand.${d}`)}
                <span className="mt-0.5 block font-mono text-[11px] font-normal text-muted">{t('demand.hint', { n: DEMAND[d] })}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <Result
        rows={[[t('gross'), som(gross)], [t('price'), `- ${som(cost)}`], [t('net'), som(gross - cost), true]]}
        sub={t('priceNote', { price: som(price) })}
        formula={t('formula', { price: som(price) })}
      />
    </div>
  );
}
