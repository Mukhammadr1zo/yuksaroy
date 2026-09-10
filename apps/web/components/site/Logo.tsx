import Image from 'next/image';

/** Belgi: olmos ramka ichida yuk. Kichik joylarda (favicon, dumaloq avatar) shu ishlatiladi. */
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return <Image src="/img/logo-mark.png" alt="" width={192} height={192} sizes={`${size}px`} style={{ height: size, width: 'auto' }} className={className} loading="eager" />;
}

/**
 * Gorizontal lokap: belgi va so'z belgisi yonma-yon.
 * compact: 400 px dan tor telefonda so'z belgisi yashiriladi (belgi qoladi), chunki sarlavha
 * qatorida til almashtirgich va kabinet tugmasi bilan birga sig'maydi (inglizchada 396 px kerak).
 * To'q fonda so'z belgisi rasm emas, matn bo'ladi, chunki rasmdagi navy harflar to'q fonda o'qilmaydi.
 */
export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image src="/img/logo-mark.png" alt={light ? '' : ''} width={192} height={192} sizes="36px" className="h-9 w-auto" priority />
      {light ? (
        <span className="font-display text-lg font-bold tracking-tight text-white">
          Yuk<span className="text-teal-lit">Saroy</span>
        </span>
      ) : (
        <Image src="/img/logo-word.png" alt="YukSaroy" width={460} height={96} sizes="91px" className={`h-[19px] w-auto ${compact ? 'max-[399px]:hidden' : ''}`} loading="eager" />
      )}
    </span>
  );
}
