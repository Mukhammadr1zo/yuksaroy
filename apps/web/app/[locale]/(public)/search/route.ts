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

  /*
   * Nisbiy Location: mutlaq manzil yasab bo'lmaydi.
   *
   * Konteyner nginx ortida turadi va `req.url` unga kelgan ichki manzilni beradi
   * (http://0.0.0.0:3000/...). Undan yasalgan Location brauzerga o'shanday yuborilar,
   * brauzer esa 0.0.0.0 ga borib ERR_ADDRESS_INVALID ko'rsatardi. Ya'ni bosh sahifadagi
   * qidiruv prodda umuman ishlamasdi.
   *
   * Nisbiy Location RFC 7231 da ruxsat etilgan va brauzer uni o'zi joriy manzilga
   * nisbatan hal qiladi, ya'ni proksi sozlamasiga umuman bog'liq emas.
   */
  const to = getPathname({ locale: locale as Locale, href: dest });
  return new NextResponse(null, { status: 307, headers: { Location: to } });
}
