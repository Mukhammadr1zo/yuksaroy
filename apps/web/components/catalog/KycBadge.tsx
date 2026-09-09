import { getTranslations } from 'next-intl/server';
import { PhoneIcon, SealCheckIcon } from '@phosphor-icons/react/dist/ssr';
import type { KycStatus } from '@yuksaroy/domain';

const PAD = { sm: 'px-2 py-0.5 text-[11px]', md: 'px-3 py-1 text-xs' } as const;
type Size = keyof typeof PAD;

/** KYC belgisi: VERIFIED teal, PENDING amber, qolganlari muted "tasdiqlanmagan". */
export async function KycBadge({ kyc, size = 'sm' }: { kyc: KycStatus; size?: Size }) {
  const t = await getTranslations('kyc');
  const tone = kyc === 'VERIFIED' ? 'bg-teal-soft text-teal-ink' : kyc === 'PENDING' ? 'bg-amber-soft text-amber-ink' : 'bg-sand text-muted';
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ${tone} ${PAD[size]}`}>
      {kyc === 'VERIFIED' ? <SealCheckIcon size={size === 'md' ? 14 : 12} weight="fill" aria-hidden="true" /> : null}
      {t(kyc)}
    </span>
  );
}

/** Yakka haydovchi belgisi: telefon OTP orqali tasdiqlangan bo'lsa teal, aks holda muted. */
export async function PhoneBadge({ verified, size = 'sm' }: { verified: boolean; size?: Size }) {
  const t = await getTranslations('listing.card');
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ${verified ? 'bg-teal-soft text-teal-ink' : 'bg-sand text-muted'} ${PAD[size]}`}>
      <PhoneIcon size={size === 'md' ? 14 : 12} weight={verified ? 'fill' : 'regular'} aria-hidden="true" />
      {t(verified ? 'phoneVerified' : 'phoneUnverified')}
    </span>
  );
}
