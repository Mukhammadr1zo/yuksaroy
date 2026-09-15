import { NextResponse } from 'next/server';
import { parseQuery, type SearchLang } from '@yuksaroy/domain';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { qs } from '@/lib/server-api';

// Bosh sahifa qidiruvi: q lug'at orqali tahlil qilinadi va mos katalogga tayyor filtrlar bilan
// yuboriladi. Katalog sahifalari q ni o'zi ham tahlil qiladi, lekin aniq paramlar ustun turadi,
// shuning uchun natija bir xil bo'ladi. Kategoriya aniqlanmasa terminallar.
export async function GET(req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  const p = q ? parseQuery(q, { lang: locale as SearchLang }) : null;

  const corridor = p?.corridor ? `${p.corridor.from}>${p.corridor.to}` : '';
  // Koridor bo'lsa region bo'sh: katalog sahifalari region ko'rsa koridorni tashlab yuboradi
  const region = corridor ? '' : p?.regions.join(',') ?? '';
  const near = p?.near ? `${p.near.lng},${p.near.lat}` : '';
  const radius = p?.near ? String(p.near.radiusKm) : '';
  const common = { region, corridor, near, radius, q };

  const dest =
    p?.category === 'equipment' ? `/equipment${qs({ ...common, kind: p.equipment, deal: p.deal })}`
    : p?.category === 'truck' ? `/carriers${qs(common)}`
    : `/terminals${qs({ ...common, service: p?.services.join(','), kind: p?.kind, bookable: p?.bookable ? '1' : '' })}`;

  return NextResponse.redirect(new URL(getPathname({ locale: locale as Locale, href: dest }), req.url), 307);
}
