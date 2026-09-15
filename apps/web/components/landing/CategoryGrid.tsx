import { getTranslations } from 'next-intl/server';
import { ShippingContainerIcon, TrainIcon, TruckIcon, WarehouseIcon } from '@phosphor-icons/react/dist/ssr';
import { SERVICE_CODES } from '@yuksaroy/domain';
import { Link } from '@/i18n/navigation';

/**
 * Platformaning uch kategoriyasi: terminal (shahobcha yo'llar ham shu ichida), texnika, avtotransport.
 * Har bir obyekt o'z egasiga tegishli, narx va shartlar egasining sahifasida.
 * Texnika va avtotransport bo'limlari hozircha bo'sh: e'lonlar egalari qo'shgach paydo bo'ladi.
 */
const CATS = [
  { href: '/terminals', key: 'terminals', Icon: WarehouseIcon, wide: true },
  { href: '/equipment', key: 'rail', Icon: TrainIcon, wide: false },
  { href: '/carriers', key: 'road', Icon: TruckIcon, wide: false },
  // Konteyner endi tur emas, xizmat: eski ?kind=CONTAINER filtri hech narsani filtrlamasdi
  { href: '/terminals?service=CONTAINER', key: 'container', Icon: ShippingContainerIcon, wide: false },
] as const;

export async function CategoryGrid() {
  const t = await getTranslations('category');
  const ts = await getTranslations('service');
  return (
    <section className="mx-auto max-w-6xl px-6 py-14 md:py-20">
      <h2 className="font-display text-2xl font-bold text-navy md:text-3xl">{t('heading')}</h2>
      <p className="mt-2 max-w-[62ch] text-muted">{t('lead')}</p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATS.map(({ href, key, Icon, wide }) => (
          <li key={href} className={wide ? 'lg:col-span-2' : ''}>
            <Link
              href={href}
              className="flex h-full items-start gap-4 rounded-card border border-line bg-white p-5 transition duration-200 hover:border-teal/50 hover:shadow-sm"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal-ink">
                <Icon size={22} weight="regular" />
              </span>
              <span>
                <span className="block font-semibold text-ink">{t(`${key}.label`)}</span>
                <span className="mt-1 block text-sm text-muted">{t(`${key}.note`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <h3 className="mt-12 font-display text-xl font-bold text-navy">{t('services.heading')}</h3>
      <ul className="mt-4 flex flex-wrap gap-2">
        {SERVICE_CODES.map((s) => (
          <li key={s}>
            <Link
              href={`/terminals?service=${s}`}
              className="inline-block rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink/80 transition duration-200 hover:border-teal hover:text-teal-ink"
            >
              {ts(s)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
