// 5-bosqich (ishonch va Premium) javob shakllari: baholar, ko'rsatishlar analitikasi, Premium buyurtmalar, murojaatlar. lib/types.ts ga tegilmaydi.
import type { ImpressionSurface } from '@yuksaroy/domain';

/** GET /terminals/:slug/reviews qatori (buyurtma raqami yashirin: YS-10**). */
export interface Review { id: string; rating: number; text: string | null; reply: string | null; repliedAt: string | null; createdAt: string; orgName: string; orderNo: string }
/** avg: 3 tadan kam baho bo'lsa null. */
export interface ReviewsPage { items: Review[]; total: number; page: number; limit: number; avg: number | null; count: number }
/** POST /orders/:no/review, GET /orders/:no/review, POST /reviews/:id/reply. */
export interface OrderReview { id: string; orderNo: string; terminalId: string; rating: number; text: string | null; reply: string | null; repliedAt: string | null; createdAt: string }

export type SurfaceCounts = Record<ImpressionSurface, number>;
/** GET /listings/:id/analytics (views) va /terminals/:id/analytics (orders), oxirgi 30 kun. */
export interface Analytics { days: ({ day: string } & SurfaceCounts)[]; totals: SurfaceCounts & { all: number }; inquiries: number; views?: number; orders?: number }

export interface PremiumOrder { id: string; listingId: string; orgId: string | null; userId: string; months: number; amountTiyin: number; status: 'PENDING' | 'PAID' | 'CANCELLED'; provider: string | null; paidAt: string | null; createdAt: string }
export interface PremiumCreated { order: PremiumOrder; pricePerMonthSom: number; payInstructions: { method: 'manual'; details: string } }
/** GET /admin/premium qatori. */
export type AdminPremiumOrder = PremiumOrder & { listing: { slug: string; title: string; premiumUntil: string | null; orgName: string | null } };

/** GET /admin/subscriptions: foydalanuvchi obunasi, admin navbati uchun. */
export interface AdminSubscription {
  id: string; no: string; userId: string; months: number; amountTiyin: number; status: 'PENDING' | 'ACTIVE' | 'CANCELLED';
  startsAt: string | null; endsAt: string | null; paidAt: string | null; createdAt: string;
  user: { fullName: string | null; phone: string | null; email: string | null };
}

export interface ContactMessage { id: string; name: string; contact: string; topic: string; message: string; createdAt: string }
export interface ContactPage { items: ContactMessage[]; total: number; page: number; limit: number }
