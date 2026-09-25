import { notFound, permanentRedirect } from 'next/navigation';
import { getPathname } from '@/i18n/navigation';
import { sapiOrNull } from '@/lib/server-api';

/**
 * Shahobcha yo'l endi alohida tur emas, temir yo'l yuk terminali.
 * Eski havolalar (qidiruv natijalari, tashqi saytlar) yo'qolmasin uchun bu yo'l
 * id bo'yicha slugni topib, terminal sahifasiga 308 bilan o'tkazadi.
 */
export default async function SidingRedirect({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const s = await sapiOrNull<{ slug: string }>(`/sidings/${id}`, 300);
  if (!s?.slug) notFound();
  permanentRedirect(getPathname({ locale, href: `/terminals/${s.slug}` }));
}
