'use client';
/**
 * Vazifa biriktirish: navbatdagi ish kimga tegishli. Bitta obyektga bitta qator (server unique),
 * qayta biriktirish = o'sha qatorni yangilash, tarix auditda.
 *
 * Nega alohida komponent: yetti moderatsiya qatori, buyurtma va shoshilinch varaqlari bir xil
 * savolga javob beradi ("kim javob beradi"), to'qqiz joyda to'qqiz xil forma bo'lmasin.
 * Xavfli amal emas (Bajarildi qaytariladi: qayta biriktirish qatorni qayta ochadi), shuning uchun
 * ikki bosqich yo'q. "Menga" bir bosish: eng ko'p ishlatiladigan yo'l eng qisqa bo'lsin.
 *
 * Komponent Fragment qaytaradi: holat sarlavha qatorining ichida turadi, forma va xabar esa
 * order-last basis-full bilan o'sha flex-wrap otaning keyingi qatoriga tushadi (sana ml-auto
 * bilan joyida qoladi). Ota har doim flex-wrap bo'lishi kerak.
 */
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { UserCirclePlusIcon } from '@phosphor-icons/react';
import { api, post } from '@/lib/api';
import { uzDate } from '@/lib/format';
import { phoneDisplay } from '@/components/ui/fields';
import { BTN, BTN_GHOST, INPUT, Notice, Pill, Popover, RowMenu, errText } from '@/components/admin/kit';
import { useAdminMe } from '@/components/admin/context';

export type TaskEntity = 'Listing' | 'Organization' | 'Terminal' | 'PremiumOrder' | 'Subscription' | 'Order' | 'UrgentRequest' | 'ContactMessage' | 'Report';
type Person = { id: string; fullName: string | null; phone: string | null };
/** GET /admin/tasks qatori (api.json). queue = serverdagi QueueKey, bosh sahifadagi WORK_LABEL kaliti. */
export type Task = {
  id: string; entity: TaskEntity; entityId: string; queue: string; title: string | null; href: string; note: string | null;
  dueAt: string | null; doneAt: string | null; doneReason: 'queue' | 'manual' | null; assignedAt: string;
  assignee: Person | null; assignedBy: Person | null;
};

const DUE_DAYS = ['', '0', '1', '3', '7'] as const;
const TZ = 'Asia/Tashkent';
const dayOf = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

/**
 * Muddat nishoni: o'tgan bo'lsa qizil, Toshkent kuni bugun bo'lsa sariq, aks holda oddiy sana.
 * Toshkent kuni bilan: server muddatni Toshkent 23:59 ga qo'yadi, brauzer boshqa mintaqada bo'lsa
 * ham "bugun" o'sha kun bo'lsin. Bosh sahifa ham shundan chizadi.
 */
export function dueTone(dueAt: string | null, now = new Date()): { tone: 'bad' | 'warn' | 'neutral'; key: 'overdue' | 'dueTodayPill' | 'dueBy' } | null {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (d.getTime() < now.getTime()) return { tone: 'bad', key: 'overdue' };
  return dayOf(d) === dayOf(now) ? { tone: 'warn', key: 'dueTodayPill' } : { tone: 'neutral', key: 'dueBy' };
}

// Xodimlar ro'yxati modul darajasida 60 s: moderatsiyada 100 qator bir vaqtda so'ramasin, bitta so'rov ketadi
let assigneesCache: { at: number; p: Promise<Person[]> } | null = null;
function fetchAssignees(): Promise<Person[]> {
  const now = Date.now();
  if (!assigneesCache || now - assigneesCache.at > 60_000) {
    const p = api<{ items: Person[] }>('/admin/tasks/assignees').then((r) => r.items);
    // Xato keshlanmaydi: keyingi ochilish qayta so'raydi
    p.catch(() => { if (assigneesCache?.p === p) assigneesCache = null; });
    assigneesCache = { at: now, p };
  }
  return assigneesCache.p;
}

/** list null va err yo'q = hali yuklanmoqda; err = so'rov yiqildi. Forma ikkisini ham aytadi ("jamoadosh yo'q" bilan adashmasin). */
export function useAssignees(): { list: Person[] | null; err: unknown } {
  const [list, setList] = useState<Person[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => {
    let on = true;
    fetchAssignees().then((x) => { if (on) setList(x); }).catch((e) => { if (on) setErr(e); });
    return () => { on = false; };
  }, []);
  return { list, err };
}

export function AssignTask({ entity, entityId, task, onChanged }: { entity: TaskEntity; entityId: string; task: Task | null; onChanged: () => void }) {
  const t = useTranslations('admin.tasks');
  const ta = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const locale = useLocale();
  const { me, isOwner } = useAdminMe();
  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // Yopilgan qator kelsa (ro'yxat open=1 so'ramagan bo'lsa) u "biriktirilmagan" bilan teng
  const live = task && !task.doneAt ? task : null;
  const mine = !!live && live.assignee?.id === me.id;
  const canClose = !!live && (mine || live.assignedBy?.id === me.id || isOwner);
  const due = live ? dueTone(live.dueAt) : null;

  async function run(req: () => Promise<unknown>, okText: string) {
    setBusy(true); setMsg(null);
    try {
      await req();
      setForm(false);
      setMsg({ tone: 'ok', text: okText });
      onChanged();
    } catch (e) { setMsg({ tone: 'err', text: errText(e, ta, ta.has, tc('saveFailed')) }); }
    finally { setBusy(false); }
  }
  const assign = (body: { assigneeId: string; dueDays?: number; note?: string }) =>
    run(() => post('/admin/tasks', { entity, entityId, ...body }), t('assigned'));
  const done = () => run(() => post(`/admin/tasks/${live!.id}/done`, {}), t('doneOk'));

  return (
    <>
      {live ? (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Pill tone={mine ? 'ok' : 'neutral'}>{mine ? t('you') : live.assignee?.fullName || (live.assignee?.phone ? phoneDisplay(live.assignee.phone) : '-')}</Pill>
          {due ? <Pill tone={due.tone}>{due.key === 'dueBy' ? t('dueBy', { date: uzDate(live.dueAt!, locale) }) : t(due.key)}</Pill> : null}
          {live.note ? <span className="max-w-48 truncate text-xs text-muted" title={live.note}>{live.note}</span> : null}
          <RowMenu items={[
            ...(canClose ? [{ label: t('done'), onSelect: () => void done(), disabled: busy }] : []),
            { label: t('reassign'), onSelect: () => setForm(true), disabled: busy },
          ]} />
        </span>
      ) : form ? null : (
        <Popover label={t('assign')} icon={<UserCirclePlusIcon size={16} aria-hidden="true" />} className={`${BTN_GHOST} px-3 py-1 text-xs`}
          items={[
            { label: t('me'), onSelect: () => void assign({ assigneeId: me.id }), disabled: busy },
            { label: t('toTeammate'), onSelect: () => setForm(true), disabled: busy },
          ]} />
      )}
      {form ? <AssignForm meId={me.id} note={live?.note ?? ''} busy={busy} onSubmit={(b) => void assign(b)} onCancel={() => setForm(false)} /> : null}
      {msg ? <div className="order-last basis-full"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
    </>
  );
}

/** Jamoadoshga forma: xodim, muddat, izoh. Enter yuboradi, Esc yopadi (Drawer ga yetmasin). */
function AssignForm({ meId, note: note0, busy, onSubmit, onCancel }: {
  meId: string; note: string; busy: boolean; onSubmit: (b: { assigneeId: string; dueDays?: number; note?: string }) => void; onCancel: () => void;
}) {
  const t = useTranslations('admin.tasks');
  const ta = useTranslations('admin');
  const tc = useTranslations('admin.common');
  const { list: people, err } = useAssignees();
  const loading = !people && !err;
  const [who, setWho] = useState(meId);
  const [days, setDays] = useState<(typeof DUE_DAYS)[number]>('');
  const [note, setNote] = useState(note0);
  return (
    <form className="order-last flex basis-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => { e.preventDefault(); onSubmit({ assigneeId: who, dueDays: days === '' ? undefined : Number(days), note: note.trim() || undefined }); }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}>
      <label className="text-xs font-semibold text-muted sm:w-56">{t('assignee')}
        {/* Yuklanayotganda select o'chirilmaydi: "Menga" baribir ishlaydi va autoFocus (Esc, Enter) yo'qolmasin; holat matn bilan aytiladi */}
        <select autoFocus value={who} onChange={(e) => setWho(e.target.value)} aria-busy={loading || undefined} className={`${INPUT} mt-1 font-normal`}>
          <option value={meId}>{t('me')}</option>
          {people?.filter((p) => p.id !== meId).map((p) => <option key={p.id} value={p.id}>{p.fullName || (p.phone ? phoneDisplay(p.phone) : p.id)}{p.fullName && p.phone ? ` (${phoneDisplay(p.phone)})` : ''}</option>)}
        </select>
        {loading ? <span className="mt-1 block text-xs font-normal text-muted">{tc('loading')}</span> : null}
      </label>
      {err ? <div className="basis-full"><Notice tone="err">{errText(err, ta, ta.has, tc('loadFailed'))}</Notice></div> : null}
      <label className="text-xs font-semibold text-muted sm:w-36">{t('due')}
        <select value={days} onChange={(e) => setDays(e.target.value as (typeof DUE_DAYS)[number])} className={`${INPUT} mt-1 font-normal`}>
          {DUE_DAYS.map((d) => <option key={d} value={d}>{d === '' ? t('dueNone') : d === '0' ? t('dueToday') : t('dueDays', { n: Number(d) })}</option>)}
        </select>
      </label>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t('note')} className={`${INPUT} sm:w-64`} />
      <span className="flex gap-2">
        <button type="submit" disabled={busy} className={`${BTN} w-full px-3 py-1.5 text-xs sm:w-auto`}>{t('assign')}</button>
        <button type="button" onClick={onCancel} className={`${BTN_GHOST} w-full px-3 py-1.5 text-xs sm:w-auto`}>{t('cancel')}</button>
      </span>
    </form>
  );
}
