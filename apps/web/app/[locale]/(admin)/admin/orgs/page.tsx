'use client';
// Tashkilotlar reestri: KYC holati, a'zolar va rollar. Yangi platforma admini AYNAN shu yerda
// tayinlanadi (PLATFORM_ADMIN roli), shuning uchun bu rol belgilanganda ekran ochiq ogohlantiradi.
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { KYC_STATUSES, ORG_KINDS, ROLES } from '@yuksaroy/domain';
import { api, post } from '@/lib/api';
import { num, uzDate } from '@/lib/format';
import { phoneDisplay } from '@/components/ui/fields';
import { BTN, BTN_GHOST, type Col, ConfirmButton, DataTable, Drawer, INPUT, Labeled, Notice, PageHead, Pager, Pill, Toolbar, errText, useAdminList } from '@/components/admin/kit';

type Row = {
  id: string; name: string; slug: string; kinds: string[]; stir: string | null; kycStatus: string; createdAt: string;
  _count: { members: number; terminals: number; listings: number };
};
type Member = { id: string; phone: string | null; fullName: string | null; roles: string[]; isOwner: boolean; createdAt: string };
type Detail = Omit<Row, '_count'> & { kycNote: string | null; counts: { terminals: number; listings: number; orders: number }; members: Member[] };
type Form = { name: string; slug: string; stir: string; kycStatus: string; kycNote: string };
type MemberEdit = { roles: string[]; isOwner: boolean };

const ADMIN = 'PLATFORM_ADMIN';
const kycTone = (s: string) => (s === 'VERIFIED' ? 'ok' : s === 'PENDING' ? 'warn' : s === 'REJECTED' ? 'bad' : 'neutral');
const toForm = (d: Detail): Form => ({ name: d.name, slug: d.slug, stir: d.stir ?? '', kycStatus: d.kycStatus, kycNote: d.kycNote ?? '' });

/** Rollar guruhi: a'zo qatorida ham, qo'shish formasida ham bir xil ko'rinadi. */
function RoleBoxes({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const tr = useTranslations('kabinet.org.role');
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {ROLES.map((r) => (
        <label key={r} className={`flex items-center gap-1 text-xs ${r === ADMIN ? 'font-semibold text-amber-ink' : ''}`}>
          <input type="checkbox" checked={value.includes(r)} className="accent-teal"
            onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />
          {tr(r)}
        </label>
      ))}
    </div>
  );
}

export default function AdminOrgsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const tk = useTranslations('kyc');
  const tok = useTranslations('orgKind');
  const locale = useLocale();
  const [f, setF] = useState({ q: '', kyc: '', kind: '', page: 1 });
  const [q, setQ] = useState('');
  const { data, pages, loading, err, reload } = useAdminList<Row>('/admin/orgs/all', { ...f, limit: 30 });

  // Yon varaq holati: qaysi tashkilot, uning to'liq yozuvi, tahrir formasi va a'zolar nusxasi
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [mem, setMem] = useState<Record<string, MemberEdit>>({});
  const [add, setAdd] = useState<{ userId: string; roles: string[]; isOwner: boolean }>({ userId: '', roles: [], isOwner: false });
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDetail = useCallback((id: string) => api<Detail>(`/admin/orgs/${id}`).then((d) => {
    setDetail(d);
    setForm(toForm(d));
    setMem(Object.fromEntries(d.members.map((m) => [m.id, { roles: m.roles, isOwner: m.isOwner }])));
  }).catch((e) => setNote({ tone: 'err', text: errText(e, t, t.has, tc('loadFailed')) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  useEffect(() => {
    setDetail(null); setForm(null); setNote(null); setAdd({ userId: '', roles: [], isOwner: false });
    if (sel) void loadDetail(sel);
  }, [sel, loadDetail]);

  const close = useCallback(() => setSel(null), []);
  const fail = (e: unknown) => setNote({ tone: 'err', text: errText(e, t, t.has, tc('saveFailed')) });
  /** A'zo o'zgargach hisob va rollar yangilansin: yon varaq ham, orqadagi ro'yxat ham. */
  const refresh = async () => { if (sel) await loadDetail(sel); void reload(); };

  async function save() {
    if (!detail || !form) return;
    const base = toForm(detail);
    // ponytail: bo'sh STIR yuborilmaydi (DTO 9 raqam talab qiladi); STIR ni o'chirish bazadan
    const diff = Object.fromEntries((Object.keys(form) as (keyof Form)[]).filter((k) => form[k] !== base[k] && !(k === 'stir' && !form[k])).map((k) => [k, form[k]]));
    if (!Object.keys(diff).length) return;
    setBusy(true); setNote(null);
    try {
      await api(`/admin/orgs/${detail.id}`, { method: 'PATCH', body: JSON.stringify(diff) });
      setNote({ tone: 'ok', text: tc('saved') });
      await refresh();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function removeOrg() {
    if (!detail) return;
    setNote(null);
    try {
      await api(`/admin/orgs/${detail.id}`, { method: 'DELETE' });
      close(); void reload();
    } catch (e) { fail(e); }
  }

  async function saveMember(userId: string) {
    if (!detail) return;
    setBusy(true); setNote(null);
    try {
      await api(`/admin/orgs/${detail.id}/members/${userId}`, { method: 'PATCH', body: JSON.stringify(mem[userId]) });
      setNote({ tone: 'ok', text: tc('saved') });
      await refresh();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function removeMember(userId: string) {
    if (!detail) return;
    setNote(null);
    try {
      await api(`/admin/orgs/${detail.id}/members/${userId}`, { method: 'DELETE' });
      setNote({ tone: 'ok', text: tc('deleted') });
      await refresh();
    } catch (e) { fail(e); }
  }

  async function addMember() {
    if (!detail || !add.userId.trim() || !add.roles.length) return;
    setBusy(true); setNote(null);
    try {
      await post(`/admin/orgs/${detail.id}/members`, { ...add, userId: add.userId.trim() });
      setNote({ tone: 'ok', text: tc('created') });
      setAdd({ userId: '', roles: [], isOwner: false });
      await refresh();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  const cols: Col<Row>[] = [
    { key: 'name', head: tc('name'), cell: (o) => (
      <div className="min-w-0">
        <div className="font-semibold text-navy">{o.name}</div>
        <div className="font-mono text-xs text-muted">{o.slug}</div>
      </div>
    ) },
    { key: 'stir', head: t('orgs.stir'), num: true, cell: (o) => o.stir ?? '' },
    { key: 'kinds', head: t('orgs.kinds'), cell: (o) => <div className="flex flex-wrap gap-1">{o.kinds.map((k) => <Pill key={k}>{tok.has(k) ? tok(k) : k}</Pill>)}</div> },
    { key: 'kyc', head: t('orgs.kyc'), cell: (o) => <Pill tone={kycTone(o.kycStatus)}>{tk.has(o.kycStatus) ? tk(o.kycStatus) : o.kycStatus}</Pill> },
    { key: 'members', head: t('orgs.members'), num: true, cell: (o) => num(o._count.members, locale) },
    { key: 'terminals', head: t('orgs.objects'), num: true, cell: (o) => num(o._count.terminals, locale) },
    { key: 'listings', head: t('nav.listings'), num: true, cell: (o) => num(o._count.listings, locale) },
    { key: 'createdAt', head: tc('createdAt'), num: true, cell: (o) => uzDate(o.createdAt, locale) },
  ];

  // Ogohlantirish: kimdadir PLATFORM_ADMIN bor yoki hozir belgilanmoqda - yangi admin shu daqiqada tug'iladi
  const adminFlag = Object.values(mem).some((m) => m.roles.includes(ADMIN)) || add.roles.includes(ADMIN);

  return (
    <>
      <PageHead title={t('nav.orgs')} lead={t('orgs.lead')} />
      <Toolbar onSubmit={() => setF({ ...f, q: q.trim(), page: 1 })}>
        <Labeled label={tc('search')} className="grow basis-56">
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} className={INPUT} />
        </Labeled>
        <Labeled label={t('orgs.kyc')} className="basis-40">
          <select value={f.kyc} onChange={(e) => setF({ ...f, kyc: e.target.value, page: 1 })} className={INPUT}>
            <option value="">{tc('all')}</option>
            {KYC_STATUSES.map((s) => <option key={s} value={s}>{tk(s)}</option>)}
          </select>
        </Labeled>
        <Labeled label={t('orgs.kinds')} className="basis-48">
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, page: 1 })} className={INPUT}>
            <option value="">{tc('all')}</option>
            {ORG_KINDS.map((k) => <option key={k} value={k}>{tok(k)}</option>)}
          </select>
        </Labeled>
        <button className={BTN}>{tc('apply')}</button>
        {data ? <span className="ml-auto font-mono text-xs text-muted">{tc('total', { count: data.total })}</span> : null}
      </Toolbar>

      {err ? <Notice tone="err">{errText(err, t, t.has, tc('loadFailed'))}</Notice> : null}
      {loading && !data ? <p className="mt-4 text-sm text-muted">{tc('loading')}</p> : null}
      {data ? <DataTable cols={cols} rows={data.items} keyOf={(o) => o.id} empty={tc('empty')} onRow={(o) => setSel(o.id)} /> : null}
      <Pager page={f.page} pages={pages} onPage={(p) => setF({ ...f, page: p })} />

      <Drawer open={!!sel} title={detail?.name ?? tc('loading')} onClose={close}
        footer={detail ? (
          <>
            <p className="w-full text-xs text-muted">{t('orgs.deleteWarn')}</p>
            <ConfirmButton label={tc('delete')} confirm={tc('confirm')} onRun={removeOrg} />
            <span className="grow" />
            <button type="button" onClick={close} className={BTN_GHOST}>{tc('cancel')}</button>
            <button type="button" disabled={busy} onClick={() => void save()} className={BTN}>{tc('save')}</button>
          </>
        ) : undefined}>
        {note ? <Notice tone={note.tone}>{note.text}</Notice> : null}
        {!detail || !form ? <p className="text-sm text-muted">{tc('loading')}</p> : (
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2">
              <Labeled label={tc('name')} className="sm:col-span-2">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} className={INPUT} />
              </Labeled>
              <Labeled label={tc('slug')}>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} maxLength={80} pattern="[a-z0-9-]+" className={`${INPUT} font-mono`} />
              </Labeled>
              <Labeled label={t('orgs.stir')}>
                <input value={form.stir} onChange={(e) => setForm({ ...form, stir: e.target.value.replace(/\D/g, '').slice(0, 9) })} inputMode="numeric" className={`${INPUT} font-mono`} />
              </Labeled>
              <Labeled label={t('orgs.kyc')}>
                <select value={form.kycStatus} onChange={(e) => setForm({ ...form, kycStatus: e.target.value })} className={INPUT}>
                  {KYC_STATUSES.map((s) => <option key={s} value={s}>{tk(s)}</option>)}
                </select>
              </Labeled>
              <Labeled label={t('orgs.kinds')}>
                <div className="flex flex-wrap gap-1 py-2">{detail.kinds.map((k) => <Pill key={k}>{tok.has(k) ? tok(k) : k}</Pill>)}</div>
              </Labeled>
              <Labeled label={t('orgs.kycNote')} className="sm:col-span-2">
                <textarea value={form.kycNote} onChange={(e) => setForm({ ...form, kycNote: e.target.value })} maxLength={500} rows={2} className={INPUT} />
              </Labeled>
              {/* O'chirish muvaffaqiyati shu raqamlarga bog'liq: birortasi noldan katta bo'lsa ORG_IN_USE */}
              <p className="font-mono text-xs text-muted sm:col-span-2">
                {t('orgs.objects')}: {num(detail.counts.terminals, locale)} / {t('nav.listings')}: {num(detail.counts.listings, locale)} / {t('nav.orders')}: {num(detail.counts.orders, locale)}
              </p>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-navy">{t('orgs.members')} <span className="font-mono text-xs text-muted">{detail.members.length}</span></h3>
              {adminFlag ? <p className="mb-2 text-xs font-semibold text-amber-ink">{t('orgs.adminNote')}</p> : null}
              <div className="divide-y divide-line rounded-card border border-line bg-white">
                {detail.members.length === 0 ? <p className="px-3 py-4 text-center text-sm text-muted">{tc('none')}</p> : null}
                {detail.members.map((m) => {
                  const e = mem[m.id] ?? { roles: m.roles, isOwner: m.isOwner };
                  return (
                    <div key={m.id} className="space-y-2 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm ${m.fullName ? 'font-semibold text-navy' : 'text-muted'}`}>{m.fullName || t('users.noName')}</span>
                        <span className="font-mono text-xs text-muted">{m.phone ? phoneDisplay(m.phone) : m.id}</span>
                        <label className="ml-auto flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={e.isOwner} className="accent-teal" onChange={(ev) => setMem({ ...mem, [m.id]: { ...e, isOwner: ev.target.checked } })} />
                          {t('orgs.isOwner')}
                        </label>
                      </div>
                      <RoleBoxes value={e.roles} onChange={(roles) => setMem({ ...mem, [m.id]: { ...e, roles } })} />
                      <div className="flex gap-1.5">
                        <button type="button" disabled={busy} onClick={() => void saveMember(m.id)} className={`${BTN_GHOST} px-3 py-1 text-xs`}>{tc('save')}</button>
                        <ConfirmButton label={tc('delete')} confirm={tc('confirm')} onRun={() => removeMember(m.id)}
                          className="inline-flex items-center rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition duration-150 hover:bg-red-50 active:scale-[0.98] disabled:opacity-60" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-card border border-line bg-white p-3">
              <h3 className="mb-2 text-sm font-semibold text-navy">{t('orgs.addMember')}</h3>
              <div className="space-y-2">
                <Labeled label={t('orgs.userId')}>
                  <input value={add.userId} onChange={(e) => setAdd({ ...add, userId: e.target.value })} className={`${INPUT} font-mono`} />
                </Labeled>
                <RoleBoxes value={add.roles} onChange={(roles) => setAdd({ ...add, roles })} />
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={add.isOwner} className="accent-teal" onChange={(e) => setAdd({ ...add, isOwner: e.target.checked })} />
                    {t('orgs.isOwner')}
                  </label>
                  <button type="button" disabled={busy || !add.userId.trim() || !add.roles.length} onClick={() => void addMember()} className={`${BTN} ml-auto`}>{tc('create')}</button>
                </div>
              </div>
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}
