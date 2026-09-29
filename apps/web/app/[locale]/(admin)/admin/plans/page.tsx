'use client';
/**
 * Tariflar: obuna nechi pul, ichida nima bor va nechta.
 *
 * Nega bu ekran kerak: ilgari narx bitta sozlama edi va "nima ochiladi" degan javob
 * kodda yozilgan edi. Ya'ni yangi tarif sotish uchun har safar dastur o'zgarishi kerak
 * edi. Endi admin yoki moderator tarifni shu yerda yaratadi, narxini va chegarasini
 * o'zi belgilaydi.
 *
 * Tarif obuna narxi va kunlik raqam sonining YAGONA manbai: sozlamada bu sonlar yo'q.
 * Shuning uchun sotuvda kamida bitta tarif turishi shart (server oxirgisini o'chirtirmaydi)
 * va telefon raqamini ochadigan tarifda kunlik son majburiy: bo'sh qoldirsa obunachi
 * nechta raqam ocha olishi noma'lum bo'lib qolardi.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PLAN_LOCALES, SUBSCRIPTION_GRANTS, type SubscriptionGrant } from '@yuksaroy/domain';
import { api, post } from '@/lib/api';
import { num } from '@/lib/format';
import { AuditLink, BTN, BTN_GHOST, type Col, ConfirmButton, DataTable, Drawer, INPUT, Labeled, Notice, PageHead, Pill, errText } from '@/components/admin/kit';

type Lang = (typeof PLAN_LOCALES)[number];
type Plan = {
  id: string; code: string; name: Record<string, string>; features: Record<string, string[]>;
  priceMonthSom: number; grants: string[]; limits: { phoneRevealDaily?: number } | null;
  maxMonths: number; sort: number; active: boolean;
};
/** Formadagi holat: tavsif har tilda bitta matn maydoni, satrlar keyin ajratiladi. */
type Draft = {
  code: string; name: Record<string, string>; features: Record<string, string>;
  priceMonthSom: number; grants: SubscriptionGrant[]; phoneRevealDaily: string;
  maxMonths: number; sort: number; active: boolean;
};

const blank = () => Object.fromEntries(PLAN_LOCALES.map((l) => [l, ''])) as Record<string, string>;
const NEW = (): Draft => ({
  code: '', name: blank(), features: blank(), priceMonthSom: 99_000,
  grants: [...SUBSCRIPTION_GRANTS], phoneRevealDaily: '', maxMonths: 12, sort: 0, active: true,
});
const toDraft = (p: Plan): Draft => ({
  code: p.code,
  name: Object.fromEntries(PLAN_LOCALES.map((l) => [l, p.name?.[l] ?? ''])),
  features: Object.fromEntries(PLAN_LOCALES.map((l) => [l, (p.features?.[l] ?? []).join('\n')])),
  priceMonthSom: p.priceMonthSom,
  grants: p.grants.filter((g): g is SubscriptionGrant => (SUBSCRIPTION_GRANTS as readonly string[]).includes(g)),
  phoneRevealDaily: p.limits?.phoneRevealDaily ? String(p.limits.phoneRevealDaily) : '',
  maxMonths: p.maxMonths, sort: p.sort, active: p.active,
});

/** Har tilning bo'sh bo'lmagan satrlari. Server ham shu shartni tekshiradi. */
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

export default function AdminPlansPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tp = useTranslations('admin.plans');
  const locale = useLocale();

  const [rows, setRows] = useState<Plan[] | null>(null);
  const [sheet, setSheet] = useState<{ id: string | null; d: Draft } | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Plan[]>('/admin/plans').then(setRows).catch((e) => setNote({ tone: 'err', text: errText(e, t, t.has, tc('loadFailed')) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (p: Partial<Draft>) => setSheet((s) => (s ? { ...s, d: { ...s.d, ...p } } : s));
  const setLang = (k: 'name' | 'features', l: Lang, v: string) => setSheet((s) => (s ? { ...s, d: { ...s.d, [k]: { ...s.d[k], [l]: v } } } : s));

  // Kunlik son faqat telefon raqamini ochadigan tarifda ma'noli: server ham shu shartni tekshiradi
  const needsDaily = !!sheet?.d.grants.includes('PHONE');
  const daily = Number(sheet?.d.phoneRevealDaily);
  // Uch tilning hammasi, kamida bitta ruxsat va (PHONE bo'lsa) kunlik son: tugma shundan keyin ochiladi
  const ready = !!sheet
    && /^[a-z0-9-]{2,30}$/.test(sheet.d.code)
    && PLAN_LOCALES.every((l) => sheet.d.name[l]?.trim() && lines(sheet.d.features[l] ?? '').length > 0)
    && sheet.d.grants.length > 0
    && (!needsDaily || daily > 0);

  async function save() {
    if (!sheet || !ready) return;
    setBusy(true);
    setNote(null);
    const d = sheet.d;
    const body = {
      code: d.code.trim(),
      name: Object.fromEntries(PLAN_LOCALES.map((l) => [l, d.name[l]!.trim()])),
      features: Object.fromEntries(PLAN_LOCALES.map((l) => [l, lines(d.features[l] ?? '')])),
      grants: d.grants,
      limits: needsDaily ? { phoneRevealDaily: daily } : {},
      priceMonthSom: Number(d.priceMonthSom) || 0,
      maxMonths: Number(d.maxMonths) || 12,
      sort: Number(d.sort) || 0,
      active: d.active,
    };
    try {
      if (sheet.id) await api(`/admin/plans/${sheet.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await post('/admin/plans', body);
      setSheet(null);
      setNote({ tone: 'ok', text: tc('saved') });
      load();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) }); } finally { setBusy(false); }
  }

  async function remove() {
    if (!sheet?.id) return;
    try {
      await api(`/admin/plans/${sheet.id}`, { method: 'DELETE' });
      setSheet(null);
      setNote({ tone: 'ok', text: tc('deleted') });
      load();
    } catch (e) { setNote({ tone: 'err', text: errText(e, t, t.has, tc('deleteFailed')) }); }
  }

  const cols: Col<Plan>[] = [
    { key: 'name', head: tp('name'), cell: (r) => <><div className="font-semibold text-navy">{r.name?.[locale] ?? r.name?.uz ?? r.code}</div><div className="font-mono text-[11px] text-muted">{r.code}</div></> },
    { key: 'price', head: tp('price'), num: true, cell: (r) => num(r.priceMonthSom, locale) },
    { key: 'grants', head: tp('grants'), cell: (r) => r.grants.map((g) => tp(`grant.${g}`)).join(', ') },
    // Faqat vagon tarifida kunlik son yo'q: chiziqcha, son emas
    { key: 'daily', head: tp('phoneRevealDaily'), num: true, cell: (r) => (r.limits?.phoneRevealDaily ? num(r.limits.phoneRevealDaily, locale) : '-') },
    { key: 'maxMonths', head: tp('maxMonths'), num: true, cell: (r) => r.maxMonths },
    { key: 'active', head: tc('status'), cell: (r) => <Pill tone={r.active ? 'ok' : 'neutral'}>{r.active ? tp('onSale') : tp('offSale')}</Pill> },
  ];

  return (
    <div>
      <PageHead title={t('nav.plans')} lead={tp('lead')}>
        <button type="button" className={BTN} onClick={() => { setNote(null); setSheet({ id: null, d: NEW() }); }}>{tp('new')}</button>
      </PageHead>

      {note && !sheet ? <Notice tone={note.tone}>{note.text}</Notice> : null}
      <p className="mt-4 font-mono text-xs text-muted">{rows === null ? tc('loading') : tc('total', { count: rows.length })}</p>
      <p className="mt-1 text-xs text-muted">{tp('note')}</p>

      <DataTable cols={cols} rows={rows ?? []} keyOf={(r) => r.id} empty={tp('empty')} onRow={(r) => { setNote(null); setSheet({ id: r.id, d: toDraft(r) }); }} />

      <Drawer
        open={!!sheet}
        title={sheet?.id ? (sheet.d.name[locale]?.trim() || sheet.d.code) : tp('new')}
        onClose={() => setSheet(null)}
        footer={sheet ? (
          <>
            {note ? <div className="w-full"><Notice tone={note.tone}>{note.text}</Notice></div> : null}
            {sheet.id ? (
              <div className="mr-auto flex flex-col items-start gap-1">
                <AuditLink entity="Plan" id={sheet.id} />
                <ConfirmButton label={tc('delete')} confirm={tc('confirm')} onRun={remove} />
              </div>
            ) : null}
            <button type="button" className={BTN_GHOST} onClick={() => setSheet(null)}>{tc('cancel')}</button>
            <button type="button" className={BTN} disabled={busy || !ready} onClick={save}>{sheet.id ? tc('save') : tc('create')}</button>
          </>
        ) : null}
      >
        {sheet ? (
          <div className="space-y-3">
            <Labeled label={tp('code')} className="block">
              {/* Kod o'zgarmaydi: olingan obunalar unga qarab hisobga olinadi */}
              <input className={INPUT} value={sheet.d.code} maxLength={30} disabled={!!sheet.id} onChange={(e) => set({ code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="vagon" />
            </Labeled>
            {PLAN_LOCALES.map((l) => (
              <Labeled key={`n-${l}`} label={`${tp('name')} (${l.toUpperCase()})`} className="block">
                <input className={INPUT} value={sheet.d.name[l] ?? ''} maxLength={80} onChange={(e) => setLang('name', l, e.target.value)} />
              </Labeled>
            ))}
            {PLAN_LOCALES.map((l) => (
              <Labeled key={`f-${l}`} label={`${tp('features')} (${l.toUpperCase()})`} className="block">
                <textarea className={`${INPUT} min-h-24 resize-y`} value={sheet.d.features[l] ?? ''} rows={4} onChange={(e) => setLang('features', l, e.target.value)} placeholder={tp('featuresHint')} />
              </Labeled>
            ))}
            <fieldset>
              <legend className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">{tp('grants')}</legend>
              <div className="flex flex-wrap gap-3">
                {SUBSCRIPTION_GRANTS.map((g) => (
                  <label key={g} className="flex items-center gap-2 text-sm text-navy">
                    <input type="checkbox" className="size-4 accent-teal" checked={sheet.d.grants.includes(g)}
                      onChange={(e) => set({ grants: e.target.checked ? [...sheet.d.grants, g] : sheet.d.grants.filter((x) => x !== g) })} />
                    {tp(`grant.${g}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label={tp('price')} className="block">
                <input type="number" min={0} step={1000} className={INPUT} value={sheet.d.priceMonthSom} onChange={(e) => set({ priceMonthSom: Number(e.target.value) })} />
              </Labeled>
              <Labeled label={tp('maxMonths')} className="block">
                <input type="number" min={1} max={12} className={INPUT} value={sheet.d.maxMonths} onChange={(e) => set({ maxMonths: Number(e.target.value) })} />
              </Labeled>
            </div>
            {/* Yulduzcha: telefon ruxsati belgilanganida maydon majburiy, tugma usiz ochilmaydi */}
            <Labeled label={`${tp('phoneRevealDaily')}${needsDaily ? ' *' : ''}`} className="block">
              <input type="number" min={1} className={INPUT} value={sheet.d.phoneRevealDaily} disabled={!needsDaily} onChange={(e) => set({ phoneRevealDaily: e.target.value })} />
            </Labeled>
            <p className="text-xs text-muted">{tp('limitHint')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label={tp('sort')} className="block">
                <input type="number" className={INPUT} value={sheet.d.sort} onChange={(e) => set({ sort: Number(e.target.value) })} />
              </Labeled>
              <Labeled label={tc('status')} className="block">
                <select className={INPUT} value={sheet.d.active ? '1' : '0'} onChange={(e) => set({ active: e.target.value === '1' })}>
                  <option value="1">{tp('onSale')}</option>
                  <option value="0">{tp('offSale')}</option>
                </select>
              </Labeled>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
