import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { sapiOrNull } from '@/lib/server-api';
import type { MarketRequest } from '@/lib/types-market';
import { RequestDetail } from '@/components/market/RequestDetail';

type Params = { params: Promise<{ locale: string; no: string }> };
const load = (no: string) => sapiOrNull<MarketRequest>(`/market/requests/${encodeURIComponent(no)}`, 30);

export async function generateMetadata({ params }: Params) {
  const { locale, no } = await params;
  const [r, t] = await Promise.all([load(no), getTranslations({ locale, namespace: 'services.requestDetail' })]);
  return { title: r ? `${r.no} · ${r.title} · YukSaroy` : t('notFound') };
}

/** Xizmat so'rovi tafsiloti: taklif faqat shu turdagi faol profili bor odamdan. */
export default async function ServiceRequestPage({ params }: Params) {
  const { locale, no } = await params;
  setRequestLocale(locale);
  const r = await load(no);
  if (!r || r.board !== 'SERVICE') notFound();
  return <RequestDetail r={r} />;
}
