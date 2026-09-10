'use client';
// Telefon hammaga ochiq (egasi qo'ng'iroqni kutadi). Bosilgani o'lchanadi: kim kimning raqamini olgani izi qoladi.
import { PhoneIcon } from '@phosphor-icons/react';
import { post } from '@/lib/api';

export function PhoneLink({ phone, kind, targetId }: { phone: string; kind: 'listing' | 'terminal'; targetId: string }) {
  return (
    <a
      href={`tel:${phone}`}
      onClick={() => { void post('/events/impressions', { items: [{ kind, targetId, surface: 'contact' }] }).catch(() => {}); }}
      className="inline-flex items-center gap-2 font-mono text-sm font-semibold text-navy hover:text-teal-ink"
    >
      <PhoneIcon size={16} className="shrink-0 text-muted" aria-hidden="true" />
      {phone}
    </a>
  );
}
