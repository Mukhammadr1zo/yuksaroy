import { REGION_ADJACENCY, type RegionCode, type UrgentStatus } from '@yuksaroy/domain';

/** Bildirishnoma oladigan tashkilot turlari (egasi Telegram bog'lagan bo'lsa). */
export const PROVIDER_KINDS = ['LOCO_SERVICE', 'CARRIER', 'ASSET_OWNER'] as const;

/** Holat o'tishlari: egasi OPEN dan taklif tanlaydi (AWARDED) yoki yopadi; AWARDED faqat yopiladi. */
export const URGENT_TRANSITIONS: Record<UrgentStatus, readonly UrgentStatus[]> = {
  OPEN: ['AWARDED', 'CLOSED', 'CANCELLED'],
  AWARDED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export const canUrgentTransition = (from: string, to: UrgentStatus): boolean =>
  (URGENT_TRANSITIONS[from as UrgentStatus] ?? []).includes(to);

/** So'rov viloyati va uning qo'shnilari (REGION_ADJACENCY). */
export const notifyRegions = (r: RegionCode): RegionCode[] => [r, ...(REGION_ADJACENCY[r] ?? [])];

/** Taklif tanlash: tanlangani AWARDED, qolgan SENT lar DECLINED. Tanlangani SENT bo'lmasa null. */
export function awardOffers(offers: { id: string; status: string }[], offerId: string): { id: string; status: 'AWARDED' | 'DECLINED' }[] | null {
  const chosen = offers.find((o) => o.id === offerId);
  if (!chosen || chosen.status !== 'SENT') return null;
  return offers.filter((o) => o.status === 'SENT').map((o) => ({ id: o.id, status: o.id === offerId ? 'AWARDED' : 'DECLINED' }));
}
