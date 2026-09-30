'use client';
/**
 * Admin panelining chap menyusi. Ilgari butun panel bitta sahifadagi yetti tab edi:
 * har tab har kirishda qayta yuklanardi va tabga havola berib bo'lmasdi.
 * Endi har bo'lim o'z manziliga ega, shu sababli menyu ham haqiqiy menyu.
 *
 * Tartib ish kuniga qarab: avval kutayotgan ish, keyin katalog, oxirida tizim.
 *
 * GROUPS eksport qilinadi: buyruq paleti (sahifalar ro'yxati) va klaviatura yo'llari
 * (g + harf) shu bitta ro'yxatdan o'qiydi, menyu bilan paleta hech qachon farq qilmaydi.
 * Rejim: full (208px, ikonka + nom + guruh sarlavhasi) yoki rail (56px, faqat ikonka).
 */
import { useTranslations } from 'next-intl';
import {
  BuildingsIcon, ChartLineIcon, ClockCounterClockwiseIcon, CreditCardIcon, EyeIcon, FlagIcon, GearIcon, HeartbeatIcon, HouseIcon,
  type Icon, MegaphoneIcon, PackageIcon, ScalesIcon, SirenIcon, StarIcon, StorefrontIcon, TagIcon, TrainRegionalIcon,
  UsersIcon, UsersThreeIcon, WarehouseIcon,
} from '@phosphor-icons/react';
import { Link, usePathname } from '@/i18n/navigation';

export type NavItem = {
  href: string; key: string; exact?: boolean;
  /** Jonli son faqat uch bandda: qaysi bo'limga kirish qarori uchun. Katalog soni qaror bermaydi. */
  badge?: 'pending' | 'ordersPending' | 'urgentOpen';
  owner?: true; icon: Icon;
  /** "g" dan keyin bosiladigan harf (AdminShell tinglaydi). */
  hotkey?: string;
};
export const GROUPS: { key: string; items: NavItem[] }[] = [
  { key: 'work', items: [
    { href: '/admin', key: 'home', exact: true, icon: HouseIcon, hotkey: 'h' },
    { href: '/admin/moderation', key: 'moderation', badge: 'pending', icon: ScalesIcon, hotkey: 'm' },
    { href: '/admin/orders', key: 'orders', badge: 'ordersPending', icon: PackageIcon, hotkey: 'o' },
    { href: '/admin/urgent', key: 'urgent', badge: 'urgentOpen', icon: SirenIcon, hotkey: 's' },
    { href: '/admin/market', key: 'market', icon: StorefrontIcon },
  ] },
  { key: 'catalog', items: [
    { href: '/admin/terminals', key: 'terminals', icon: WarehouseIcon, hotkey: 't' },
    { href: '/admin/stations', key: 'stations', icon: TrainRegionalIcon },
    { href: '/admin/listings', key: 'listings', icon: MegaphoneIcon, hotkey: 'l' },
    { href: '/admin/reviews', key: 'reviews', icon: StarIcon },
  ] },
  { key: 'people', items: [
    { href: '/admin/orgs', key: 'orgs', icon: BuildingsIcon, hotkey: 'r' },
    { href: '/admin/users', key: 'users', icon: UsersIcon, hotkey: 'u' },
    { href: '/admin/team', key: 'team', owner: true, icon: UsersThreeIcon },
  ] },
  { key: 'system', items: [
    // Avval peshtaxta, keyin kassa: tarif obuna narxining yagona manbai, tarifsiz obuna
    // sotilmaydi. Tarif yaratish operatorga ham ochiq: egasi shuni so'radi, server ham shunday
    { href: '/admin/plans', key: 'plans', icon: TagIcon, hotkey: 'p' },
    // Obunachilar reyestri: operator ham ko'radi (kim to'lagan degan savol kundalik ish),
    // lekin tasdiqlangan obunani bekor qilish faqat egada
    { href: '/admin/subscriptions', key: 'subscriptions', icon: CreditCardIcon, hotkey: 'b' },
    // Reklamani ega sotadi, operator matnini ko'radi: server ham shunday ajratadi
    { href: '/admin/ads', key: 'ads', icon: FlagIcon },
    // Pul hisobi: server ham faqat egaga beradi
    { href: '/admin/revenue', key: 'revenue', owner: true, icon: ChartLineIcon },
    { href: '/admin/visits', key: 'visits', icon: EyeIcon },
    { href: '/admin/audit', key: 'audit', icon: ClockCounterClockwiseIcon, hotkey: 'a' },
    // Server holati (baza, vagon manbasi, xatolar, disk): serverga kira oladigan odam ega, operator emas
    { href: '/admin/system', key: 'system', owner: true, icon: HeartbeatIcon },
    // Komissiya foizi va muddatlar: operatorga ko'rinmaydi, server ham ruxsat bermaydi
    { href: '/admin/settings', key: 'settings', owner: true, icon: GearIcon },
  ] },
];

export function AdminNav({ counts, isOwner = false, mode = 'full', onNavigate }: {
  counts?: Partial<Record<string, number>>; isOwner?: boolean; mode?: 'full' | 'rail'; onNavigate?: () => void;
}) {
  const t = useTranslations('admin.nav');
  const ts = useTranslations('admin.shell');
  const path = usePathname();
  const rail = mode === 'rail';
  return (
    <nav aria-label={t('aria')} className={`flex flex-col ${rail ? 'w-14 items-center gap-2 px-2 py-3' : 'w-52 gap-4 px-3 py-4'}`}>
      {GROUPS.map((g) => (
        <div key={g.key} className={`flex flex-col ${rail ? 'items-center gap-1' : 'gap-0.5'}`}>
          {/* Guruh sarlavhasi faqat to'liq rejimda: rail da ikonkalar orasidagi bo'shliq guruhni ajratadi */}
          {rail
            ? <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />
            : <span className="px-3 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted">{t(`group.${g.key}`)}</span>}
          {g.items.filter((it) => !it.owner || isOwner).map(({ href, key, exact, badge, icon: Ic, hotkey }) => {
            const on = exact ? path === href : path === href || path.startsWith(`${href}/`);
            const n = badge ? counts?.[badge] : undefined;
            const name = t(key);
            // Tooltip da yo'l ham: "Moderatsiya (g m)", odam yo'lni shu yerdan o'rganadi
            const title = hotkey ? `${name} (g ${hotkey})` : name;
            return (
              <Link key={href} href={href} title={title} aria-label={rail ? name : undefined} aria-current={on ? 'page' : undefined} onClick={onNavigate}
                className={`relative flex items-center gap-2.5 rounded-xl text-sm font-semibold transition-colors duration-150 ${rail ? 'h-10 w-10 justify-center' : 'px-3 py-2'} ${on ? 'bg-navy text-white' : 'text-muted hover:bg-white hover:text-navy'}`}>
                <Ic size={18} aria-hidden="true" className="shrink-0" />
                {rail ? null : <span className="min-w-0 flex-1 truncate">{name}</span>}
                {n ? (
                  rail
                    // Rail da son sig'maydi: amber nuqta, soni ekran o'quvchi uchun
                    ? <span role="img" aria-label={ts('badgeAria', { n })} className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber ring-2 ring-sand" />
                    // Amber fonda matn ink: oq raqam bu fonda 2.62 edi. Tanlangan qatorda fon navy, o'shanda oq to'g'ri.
                    : <span className={`rounded-full px-1.5 font-mono text-[11px] tabular-nums ${on ? 'bg-white/20 text-white' : 'bg-amber text-ink'}`}>{n}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
