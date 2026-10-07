// Xarita tasmasining ramkasi: 300px quti, "Xaritani ochish" tugmasi va attributsiya, bosish -> /map.
// Alohida faylda, chunki MapView maplibre ni import qiladi: bosh sahifa ramkani shu yerdan oladi
// va kutubxonasiz chiziladi, jonli xarita esa keyin ichiga (children) qo'shiladi.
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

export function StripFrame({ children }: { children?: ReactNode }) {
  const t = useTranslations('map');
  return (
    <div className="relative h-[300px] overflow-hidden rounded-card border border-line bg-sand">
      {children}
      <Link href="/map" aria-label={t('strip.aria')} className="absolute inset-0 z-10">
        <span className="absolute bottom-3 right-3 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white">{t('open')}</span>
        <span className="absolute bottom-1.5 left-2.5 font-mono text-[9px] text-muted/80">© OpenStreetMap, © CARTO</span>
      </Link>
    </div>
  );
}
