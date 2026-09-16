'use client';
// Platforma sozlamalari: ilgari bularni faqat bazadan o'zgartirish mumkin edi.
// Faqat o'zgargan kalitlar yuboriladi: server o'zgarmaganini auditga yozmaydi, biz ham shovqin qilmaymiz.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { BTN, CARD, INPUT, Notice, PageHead, Pill, errText } from '@/components/admin/kit';

type Item = { key: string; value: string | number; default: string | number; isDefault: boolean; updatedAt: string | null };
type Resp = { items: Item[] };

const LABEL = 'font-mono text-[11px] text-muted';

/**
 * Har bir kalitning chegarasi serverdagi tekshiruv bilan bir xil
 * (admin-system.controller.ts, CHECK). Ilgari hamma maydonda min=0 turardi va
 * muddatga 0 yozib bo'lardi: server esa musbat son talab qiladi. Natijada faqat
 * "Qiymat noto'g'ri" chiqar, qaysi maydon ekani va nega ekani aytilmasdi.
 * Komissiya bazis punktda saqlanadi: 10000 = 100 %.
 */
const BOUNDS: Record<string, { min: number; max?: number }> = {
  commissionPct: { min: 0, max: 10000 },
  slotHoldTtlMin: { min: 1 },
  terminalConfirmMin: { min: 1 },
  docSlaHours: { min: 1 },
};

export default function SettingsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const ts = useTranslations('admin.settings');
  const [items, setItems] = useState<Item[] | null>(null);
  // Maydon matni kalit bo'yicha; saqlashda raqamli kalitlar Number ga qaytadi
  const [vals, setVals] = useState<Record<string, string>>({});
  const [err, setErr] = useState<unknown>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = (r: Resp) => { setItems(r.items); setVals(Object.fromEntries(r.items.map((i) => [i.key, String(i.value)]))); };
  useEffect(() => { api<Resp>('/admin/settings').then(load).catch(setErr); }, []);

  // Faqat yuklanganidan farq qilganlar, raqam raqam bo'lib.
  // Bo'shatilgan maydon o'zgarish hisoblanmaydi: Number('') = 0 bo'lgani uchun tozalangan
  // komissiya jimgina 0 bo'lib saqlanardi.
  const values: Record<string, string | number> = {};
  for (const it of items ?? []) {
    const raw = vals[it.key] ?? '';
    if (raw.trim() === '') continue;
    const v = typeof it.default === 'number' ? Number(raw) : raw;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    if (v !== it.value) values[it.key] = v;
  }
  const dirty = Object.keys(values).length > 0;

  async function save() {
    setBusy(true); setErr(null); setOk(false);
    try { load(await api<Resp>('/admin/settings', { method: 'PUT', body: JSON.stringify({ values }) })); setOk(true); }
    catch (e) { setErr(e); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title={t('nav.settings')} lead={ts('lead')} />

      {items === null && !err ? <p className="mt-5 text-sm text-muted">{tc('loading')}</p> : null}

      <form className="mt-5" onSubmit={(e) => { e.preventDefault(); if (dirty && !busy) void save(); }}>
        {(items ?? []).map((it) => (
          <div key={it.key} className={`${CARD} mt-3 flex flex-wrap items-start justify-between gap-3 p-4`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-navy">{ts(`key.${it.key}`)}</span>
                {it.isDefault ? <Pill>{ts('isDefault')}</Pill> : null}
              </div>
              <p className="mt-0.5 text-xs text-muted">{ts(`hint.${it.key}`)}</p>
              <p className="mt-1 font-mono text-xs text-muted">{ts('default', { value: String(it.default) })}</p>
            </div>
            <label className="w-full sm:w-56">
              <span className={`mb-1 block ${LABEL}`}>{it.key}</span>
              {it.key === 'commissionPayer' ? (
                <select className={INPUT} value={vals[it.key] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [it.key]: e.target.value }))}>
                  <option value="TERMINAL">TERMINAL</option>
                  <option value="CLIENT">CLIENT</option>
                </select>
              ) : (
                <input type="number" min={BOUNDS[it.key]?.min ?? 1} max={BOUNDS[it.key]?.max} step={1}
                  className={`${INPUT} font-mono tabular-nums`} value={vals[it.key] ?? ''}
                  onChange={(e) => setVals((v) => ({ ...v, [it.key]: e.target.value }))} />
              )}
              {/* Bazis punkt saqlanadi (300 = 3,00 %): odam "3" yozib 3 % deb o'ylamasin, foizni jonli ko'rsatamiz */}
              {it.key === 'commissionPct' ? <span className="mt-1 block font-mono text-xs text-teal-ink">= {(Number(vals[it.key]) / 100).toFixed(2)} %</span> : null}
            </label>
          </div>
        ))}

        {err ? <Notice tone="err">{errText(err, (k) => t(k), t.has, items ? tc('saveFailed') : tc('loadFailed'))}</Notice> : null}
        {ok ? <Notice tone="ok">{tc('saved')}</Notice> : null}

        {items ? <div className="mt-4 flex justify-end"><button type="submit" className={BTN} disabled={!dirty || busy}>{tc('save')}</button></div> : null}
      </form>
    </>
  );
}
