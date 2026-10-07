import { uzLocalDate, uzLocalToUtc, type SearchLang } from '@yuksaroy/domain';
import { QUEUE_DEF, TASK_ENTITIES, queueOf, queueWhere, tbl, type TaskEntity } from './admin-queues';
import type { PrismaService } from './prisma.service';

/**
 * Vazifa biriktirish: navbatdagi ish jamoadoshga. Bitta AdminTask jadvali (entity, entityId),
 * AdminNote naqshi. Navbat sharti QUEUE_DEF da: element navbatdan chiqsa vazifa o'zi yopiladi.
 * Nega qaror yo'llariga ilgak yo'q: 9 yo'l 5 modulda, birini unutish oson; navbat sharti
 * bitta joyda va vazifa undan ajralmaydi.
 */
export const DUE_DAYS = [0, 1, 3, 7] as const;
const DAY = 86_400_000;
const TITLE_MAX = 120;

/** Muddat: N kundan keyingi Toshkent kunining 23:59 (kun oxirigacha); null = muddatsiz. */
export const dueAtOf = (now: Date, days: number | null | undefined): Date | null =>
  days == null ? null : uzLocalToUtc(uzLocalDate(new Date(now.getTime() + days * DAY)), '23:59');

/** Telegram xabaridagi muddat satri: notifyParts bo'sh qatorni tashlaydi, shuning uchun butun satr vars dan keladi. */
export const DUE_LINE: Record<SearchLang, { at: string; none: string }> = {
  uz: { at: 'Muddat: ', none: 'Muddatsiz' },
  ru: { at: 'Срок: ', none: 'Без срока' },
  en: { at: 'Due: ', none: 'No deadline' },
};

/** Vazifadan panel sahifasi. Obyekt sahifasi yo'q navbatlarda #id (karta li id) yoki ?open/?q. */
export function taskHref(entity: TaskEntity, id: string, no?: string | null): string {
  // Obyekt o'chirilgan bo'lsa no yo'q: havola baribir chiziladi, id bilan
  const key = encodeURIComponent(no ?? id);
  switch (entity) {
    case 'Listing': return `/admin/listings/${id}`;
    case 'Organization': return `/admin/orgs/${id}`;
    case 'Terminal': return `/admin/terminals/${id}`;
    case 'PremiumOrder': return `/admin/moderation?tab=premium#${id}`;
    case 'Subscription': return `/admin/subscriptions?open=${id}`;
    case 'Order': return `/admin/orders?open=${key}`;
    case 'UrgentRequest': return `/admin/urgent?q=${key}`;
    case 'ContactMessage': return `/admin/moderation?tab=contact#${id}`;
    case 'Report': return `/admin/moderation?tab=reports#${id}`;
    // Panelda yozishma ekrani yo'q: javob kabinetdagi tredda yoziladi (QUEUE_HREF bilan bir joy)
    case 'Inquiry': return `/dashboard/inquiries/${id}`;
  }
}

export type TaskTitle = { title: string; no?: string };
const cut = (s: string) => (s.length > TITLE_MAX ? s.slice(0, TITLE_MAX) : s);

/** Obyekt sarlavhalari (ro'yxat va xabar uchun). Topilmagan id xaritada yo'q: o'chirilgan obyekt. */
export async function taskTitles(prisma: PrismaService, entity: TaskEntity, ids: string[]): Promise<Map<string, TaskTitle>> {
  const out = new Map<string, TaskTitle>();
  if (!ids.length) return out;
  const w = { where: { id: { in: ids } } };
  const put = (id: string, title: string, no?: string) => out.set(id, { title: cut(title), ...(no ? { no } : {}) });
  switch (entity) {
    case 'Listing': for (const r of await prisma.listing.findMany({ ...w, select: { id: true, title: true } })) put(r.id, r.title); break;
    case 'Organization': for (const r of await prisma.organization.findMany({ ...w, select: { id: true, name: true } })) put(r.id, r.name); break;
    case 'Terminal': for (const r of await prisma.terminal.findMany({ ...w, select: { id: true, name: true } })) put(r.id, r.name); break;
    case 'PremiumOrder':
      for (const r of await prisma.premiumOrder.findMany({ ...w, select: { id: true, months: true, listing: { select: { title: true } } } })) put(r.id, `${r.listing.title}, ${r.months} oy`);
      break;
    case 'Subscription':
      for (const r of await prisma.subscription.findMany({ ...w, select: { id: true, no: true, user: { select: { phone: true } } } })) put(r.id, `${r.no}, ${r.user.phone ?? ''}`);
      break;
    case 'Order': for (const r of await prisma.order.findMany({ ...w, select: { id: true, no: true } })) put(r.id, r.no, r.no); break;
    case 'UrgentRequest': for (const r of await prisma.urgentRequest.findMany({ ...w, select: { id: true, no: true } })) put(r.id, r.no, r.no); break;
    case 'ContactMessage': for (const r of await prisma.contactMessage.findMany({ ...w, select: { id: true, name: true, topic: true } })) put(r.id, `${r.name}: ${r.topic}`); break;
    case 'Report': for (const r of await prisma.report.findMany({ ...w, select: { id: true, targetTitle: true } })) put(r.id, r.targetTitle); break;
    // Obyekt nomi yolg'iz yetmaydi: bitta obyektga bir necha mijoz yozadi, savolning o'zi qaysi suhbatligini aytadi
    case 'Inquiry':
      for (const r of await prisma.inquiry.findMany({ ...w, select: { id: true, message: true, terminal: { select: { name: true } } } })) put(r.id, r.terminal ? `${r.terminal.name}: ${r.message}` : r.message);
      break;
  }
  return out;
}

/** Berilgan id lardan hali navbatda turganlari (queueWhere: badge bilan bir xil shart). */
export async function inQueue(prisma: PrismaService, entity: TaskEntity, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const k = queueOf(entity);
  const rows = await tbl(prisma, QUEUE_DEF[k].model).findMany({ where: { AND: [await queueWhere(prisma, k), { id: { in: ids } }] }, select: { id: true } });
  return new Set(rows.map((r) => r.id as string));
}

/** Sof: navbatda qolmagan ochiq vazifalarning id lari. Xaritada yo'q tur ham chiqqan deb sanaladi. */
export function staleTaskIds(open: readonly { id: string; entity: string; entityId: string }[], stillOpen: ReadonlyMap<string, ReadonlySet<string>>): string[] {
  return open.filter((t) => !stillOpen.get(t.entity)?.has(t.entityId)).map((t) => t.id);
}

/**
 * Navbatdan chiqqan ishning vazifasi yopiladi (doneReason 'queue'). Sweeper tikida (30 s) va
 * ro'yxat o'qilganda chaqiriladi. ponytail: bir tikda 500 ochiq vazifa; oshsa qolgani keyingisida.
 */
export async function closeStaleTasks(prisma: PrismaService, now: Date): Promise<number> {
  const open = await prisma.adminTask.findMany({ where: { doneAt: null }, select: { id: true, entity: true, entityId: true }, take: 500 });
  if (!open.length) return 0;
  const byEntity = new Map<TaskEntity, string[]>();
  for (const t of open) {
    if (!(TASK_ENTITIES as readonly string[]).includes(t.entity)) continue; // noma'lum tur navbatda emas: yopiladi
    const e = t.entity as TaskEntity;
    byEntity.set(e, [...(byEntity.get(e) ?? []), t.entityId]);
  }
  const still = new Map<string, Set<string>>();
  await Promise.all([...byEntity].map(async ([e, ids]) => still.set(e, await inQueue(prisma, e, ids))));
  const stale = staleTaskIds(open, still);
  if (!stale.length) return 0;
  const r = await prisma.adminTask.updateMany({ where: { id: { in: stale } }, data: { doneAt: now, doneReason: 'queue' } });
  return r.count;
}
