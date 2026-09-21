import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { sapiOrNull } from '@/lib/server-api';
import type { MarketRequest } from '@/lib/types-market';
import { RequestDetail } from '@/components/market/RequestDetail';

type Params = { params: Promise<{ locale: string; no: string }> };
// Yopilgan yoki eskirgan yuk ham ochiladi (havola Telegramdan keladi); 30 soniya kesh: takliflar soni yangi tursin
const load = (no: string) => sapiOrNull<MarketRequest>(`/market/requests/${encodeURIComponent(no)}`, 30);

export async function generateMetadata({ params }: Params) {
  const { locale, no } = await params;
  const [r, t] = await Promise.all([load(no), getTranslations({ locale, namespace: 'cargo.detail' })]);
  return { title: r ? `${r.no} · ${r.title} · YukSaroy` : t('notFound') };
}

/** Yuk tafsiloti: ochiq sahifa, telefon faqat obunachiga, taklif formasi kirganlarga. */
export default async function CargoDetailPage({ params }: Params) {
  const { locale, no } = await params;
  setRequestLocale(locale);
  const r = await load(no);
  if (!r || r.board !== 'CARGO') notFound();
  return <RequestDetail r={r} />;
}
