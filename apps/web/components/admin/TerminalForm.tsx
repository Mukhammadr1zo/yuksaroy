'use client';
/**
 * Admin terminal formasi (yon varaq ichi). Holat sahifada turadi: saqlash va o'chirish
 * tugmalari varaq pastida, forma faqat maydonlarni chizadi va o'zgarishni yuqoriga beradi.
 * Temir yo'l pasporti faqat RAIL/MULTI da ko'riladi: avto terminalda 30 ta bo'sh katak shovqin.
 */
import { useTranslations } from 'next-intl';
import {
  CLAIM_STATUSES, REGIONS, RJUS, TERMINAL_KINDS, TERMINAL_STATUSES,
  type ClaimStatus, type RegionCode, type Rju, type TerminalKind, type TerminalStatus,
} from '@yuksaroy/domain';
import { INPUT, Labeled } from '@/components/admin/kit';

/** GET /admin/catalog/terminals/:id. Sana ustunlari ISO qator bo'lib keladi. */
export type TerminalFull = {
  id: string; slug: string; name: string; kind: TerminalKind; status: TerminalStatus;
  regionCode: RegionCode | null; stationId: string | null; orgId: string | null;
  address: string | null; phone: string | null; lat: number | null; lng: number | null; is24h: boolean;
  claimStatus: ClaimStatus; claimOrgId: string | null;
  registryNo: number | null; registryRef: string | null; stationNameRaw: string | null; esrCode: string | null; rju: Rju | null;
  ownerNameRaw: string | null; lengthM: number | null; trackCount: number | null; capacityWagons: number | null; occupiedWagons: number | null;
  loadCapacity: number; unloadCapacity: number; deadEndDistanceM: number | null; junctionSwitch: string | null; brakeShoes: number | null;
  nogabarit: string | null; equipment: string | null; loadNorm: string | null; unloadNorm: string | null; loadFront: string | null; unloadFront: string | null;
  locoType: string | null; locoNote: string | null; processingHours: number | null; contractNo: string | null;
  contractStart: string | null; contractEnd: string | null; contractState: string | null;
  category: string | null; usageType: string | null; operStatus: string | null; note: string | null;
  contactName: string | null; contactPhone: string | null;
  createdAt: string;
  station: { id: string; nameUz: string } | null;
  org: { id: string; name: string } | null;
};
export type Draft = Partial<TerminalFull>;
type K = keyof TerminalFull;

/**
 * PATCH/POST ga ketadigan kalitlar, DTO bilan bir xil. taminotId import kaliti, qo'lda o'zgarmaydi.
 */
const EDITABLE: K[] = [
  'name', 'slug', 'kind', 'status', 'regionCode', 'stationId', 'orgId', 'address', 'phone', 'lat', 'lng', 'is24h', 'claimStatus', 'claimOrgId',
  'registryNo', 'registryRef', 'stationNameRaw', 'esrCode', 'rju', 'ownerNameRaw', 'lengthM', 'loadCapacity', 'unloadCapacity', 'trackCount', 'capacityWagons', 'occupiedWagons',
  'deadEndDistanceM', 'junctionSwitch', 'brakeShoes', 'nogabarit', 'equipment', 'loadNorm', 'unloadNorm', 'loadFront', 'unloadFront',
  'locoType', 'locoNote', 'processingHours', 'contractNo', 'contractStart', 'contractEnd', 'contractState', 'category', 'usageType', 'operStatus', 'note',
  'contactName', 'contactPhone',
];
/** Bo'sh qoldirib bo'lmaydigan ustunlar: bo'sh kelsa yuborilmaydi (slug ni server o'zi yasaydi). */
const REQUIRED = new Set<K>(['name', 'slug']);

/** Yuklangan qator formaga: sana "YYYY-MM-DD" ga, chunki date input shuni kutadi va diff shunga solishtiradi. */
export function fromRow(r: TerminalFull): Draft {
  return { ...r, contractStart: r.contractStart?.slice(0, 10) ?? null, contractEnd: r.contractEnd?.slice(0, 10) ?? null };
}

/** Bazada NOT NULL: bo'shatilgan maydon null emas, 0 bo'lib ketishi kerak, aks holda Prisma 500 beradi. */
const NOT_NULL_NUM = new Set<K>(['loadCapacity', 'unloadCapacity']);

/** Faqat o'zgargan kalitlar: audit meta haqiqiy o'zgarishni ko'rsatsin. Bo'sh qator -> null. base=null: yaratish. */
export function diffBody(d: Draft, base: Draft | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    let v = d[k] === '' ? null : d[k];
    if (v == null && NOT_NULL_NUM.has(k)) v = 0;
    if (v == null && (REQUIRED.has(k) || !base)) continue;
    if (base && Object.is(v ?? null, base[k] ?? null)) continue;
    out[k] = v;
  }
  return out;
}

export function TerminalForm({ d, set }: { d: Draft; set: (p: Draft) => void }) {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tt = useTranslations('admin.terminals');
  const cl = useTranslations('claim');
  const tk = useTranslations('kind');
  const tr = useTranslations('region');
  const trju = useTranslations('rju');

  const val = (k: K) => (d[k] as string | number | null | undefined) ?? '';
  const text = (k: K, label: string, ph?: string) => (
    <Labeled label={label}><input className={INPUT} value={val(k)} placeholder={ph} onChange={(e) => set({ [k]: e.target.value } as Draft)} /></Labeled>
  );
  const num = (k: K, label: string, step?: string, ro = false) => (
    <Labeled label={label}>
      <input type="number" step={step} className={INPUT} value={val(k)} disabled={ro}
        onChange={(e) => set({ [k]: e.target.value === '' ? null : Number(e.target.value) } as Draft)} />
    </Labeled>
  );
  const date = (k: K, label: string) => (
    <Labeled label={label}><input type="date" className={INPUT} value={val(k)} onChange={(e) => set({ [k]: e.target.value || null } as Draft)} /></Labeled>
  );
  const sel = (k: K, label: string, opts: readonly string[], lbl: (v: string) => string, nullable = false) => (
    <Labeled label={label}>
      <select className={INPUT} value={val(k)} onChange={(e) => set({ [k]: e.target.value || null } as Draft)}>
        {nullable ? <option value="">-</option> : null}
        {opts.map((o) => <option key={o} value={o}>{lbl(o)}</option>)}
      </select>
    </Labeled>
  );
  const section = (title: string) => <h3 className="mt-6 mb-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-navy first:mt-0">{title}</h3>;
  const rail = d.kind === 'RAIL' || d.kind === 'MULTI';

  return (
    <div>
      {section(tt('basic'))}
      <div className="grid gap-3 sm:grid-cols-2">
        {text('name', tc('name'))}
        {text('slug', tt('f.slug'))}
        {sel('kind', tt('kind'), TERMINAL_KINDS, (v) => tk(v))}
        {sel('status', tc('status'), TERMINAL_STATUSES, (v) => v)}
        {sel('regionCode', tc('region'), REGIONS, (v) => tr(v), true)}
        {text('stationId', tt('f.stationId'), 'id')}
        {text('orgId', tt('f.orgId'), 'id')}
        {text('phone', tc('phone'))}
        <div className="sm:col-span-2">{text('address', tt('f.address'))}</div>
        {num('lat', tt('f.lat'), 'any')}
        {num('lng', tt('f.lng'), 'any')}
        <label className="flex items-center gap-2 text-sm text-navy sm:col-span-2">
          <input type="checkbox" className="accent-teal" checked={!!d.is24h} onChange={(e) => set({ is24h: e.target.checked })} />
          {tt('f.is24h')}
        </label>
        {sel('claimStatus', tt('claim'), CLAIM_STATUSES, (v) => v)}
        {text('claimOrgId', tt('f.claimOrgId'), 'id')}
      </div>

      {rail ? (
        <>
          {section(tt('railHead'))}
          <div className="grid gap-3 sm:grid-cols-2">
            {num('registryNo', cl('registryNo'))}
            {text('registryRef', tt('f.registryRef'))}
            {text('stationNameRaw', cl('station'))}
            {text('esrCode', cl('esr'))}
            {sel('rju', cl('rjuRow'), RJUS, (v) => trju(v), true)}
            {text('ownerNameRaw', cl('registryOwner'))}
            {num('lengthM', cl('length'))}
            {num('trackCount', cl('tracks'))}
            {num('capacityWagons', cl('capacity'))}
            {num('occupiedWagons', tt('f.occupiedWagons'))}
            {num('loadCapacity', cl('load'))}
            {num('unloadCapacity', cl('unload'))}
            {num('deadEndDistanceM', cl('deadEnd'))}
            {text('junctionSwitch', cl('junction'))}
            {num('brakeShoes', cl('brakeShoes'))}
            {text('nogabarit', cl('nogabarit'))}
            <div className="sm:col-span-2">{text('equipment', cl('equipment'))}</div>
            {text('loadNorm', cl('loadNorm'))}
            {text('unloadNorm', cl('unloadNorm'))}
            {text('loadFront', cl('loadFront'))}
            {text('unloadFront', cl('unloadFront'))}
            {text('locoType', cl('loco'))}
            {text('locoNote', tt('f.locoNote'))}
            {num('processingHours', cl('processing'), 'any')}
            {text('contractNo', cl('contractNo'))}
            {date('contractStart', tt('f.contractStart'))}
            {date('contractEnd', tt('f.contractEnd'))}
            {text('contractState', cl('contractState'))}
            {text('category', tt('f.category'))}
            {text('usageType', tt('f.usageType'))}
            {text('operStatus', tt('f.operStatus'))}
            <div className="sm:col-span-2">
              <Labeled label={cl('note')}>
                <textarea className={`${INPUT} min-h-20`} rows={3} value={val('note')} onChange={(e) => set({ note: e.target.value })} />
              </Labeled>
            </div>
          </div>
        </>
      ) : null}

      {section(tt('contact'))}
      <div className="grid gap-3 sm:grid-cols-2">
        {text('contactName', tt('f.contactName'))}
        {text('contactPhone', tt('f.contactPhone'))}
      </div>
    </div>
  );
}
