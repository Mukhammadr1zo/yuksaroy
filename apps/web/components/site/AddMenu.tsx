'use client';
// Bitta "Qo'shish" nuqtasi: ilgari e'lon, terminal, shahobcha, buyurtma va shoshilinch so'rov
// bir-biridan uzoq sahifalardan boshlanardi. Formalar o'zgarmadi, faqat kirish yo'li bitta bo'ldi.
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlusIcon, ShippingContainerIcon, PathIcon, TrainIcon, TruckIcon, PackageIcon, LightningIcon, BriefcaseIcon, HandshakeIcon } from '@phosphor-icons/react';
import { Link } from '@/i18n/navigation';
import { useMe } from './useMe';

const OFFER = [
  { key: 'terminal', href: '/dashboard/terminals/new', Icon: ShippingContainerIcon },
  { key: 'siding', href: '/dashboard/sidings', Icon: PathIcon },
  { key: 'equipment', href: '/dashboard/listings/new', Icon: TrainIcon },
  { key: 'truck', href: '/dashboard/listings/new?kind=TRUCK', Icon: TruckIcon },
  { key: 'service', href: '/dashboard/market?tab=profile', Icon: BriefcaseIcon },
] as const;
const NEED = [
  { key: 'order', href: '/dashboard/orders/new', Icon: PackageIcon },
  { key: 'urgent', href: '/dashboard/orders?tab=urgent', Icon: LightningIcon },
  { key: 'cargo', href: '/cargo/new', Icon: PackageIcon },
  { key: 'serviceRequest', href: '/services/request', Icon: HandshakeIcon },
] as const;

export function AddMenu() {
  const t = useTranslations('nav.add');
  const me = useMe();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!me) return null;
  const group = (title: string, items: readonly { key: string; href: string; Icon: typeof PlusIcon }[]) => (
    <div className="p-1.5">
      <p className="px-3 pb-1 pt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{title}</p>
      {items.map(({ key, href, Icon }) => (
        <Link key={key} href={href} role="menuitem" onClick={() => setOpen(false)}
          className="flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-sand">
          <Icon size={18} weight="duotone" className="mt-0.5 shrink-0 text-teal" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{t(`${key}.title`)}</span>
            <span className="block text-xs text-muted">{t(`${key}.body`)}</span>
          </span>
        </Link>
      ))}
    </div>
  );

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-full bg-teal px-3 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-teal-ink sm:px-4">
        <PlusIcon size={14} weight="bold" aria-hidden="true" />
        <span className="hidden sm:inline">{t('label')}</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white shadow-lg">
          {group(t('offer'), OFFER)}
          <div className="border-t border-line">{group(t('need'), NEED)}</div>
        </div>
      ) : null}
    </div>
  );
}
