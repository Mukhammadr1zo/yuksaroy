import Image from 'next/image';
import mark from '@/public/img/logo-mark.png';
import word from '@/public/img/logo-word.png';

// Rasmlar import qilinadi, /img/... manzili bilan emas: Next fayl mazmunidan xesh yasaydi
// (/_next/static/media/logo-mark.<xesh>.png). Logo almashtirilsa manzil ham o'zgaradi va
// hech kimda eski nusxa qolib ketmaydi. O'lcham ham importdan keladi, qo'lda yozilmaydi.

/** Belgi: dumaloq avatar va kichik joylar uchun. */
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return <Image src={mark} alt="" sizes={`${size}px`} style={{ height: size, width: 'auto' }} className={className} loading="eager" />;
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
      <Image src={mark} alt="" sizes="36px" className="h-9 w-auto" priority />
      {light ? (
        <span className="font-display text-lg font-bold tracking-tight text-white">
          Yuk<span className="text-teal-lit">Saroy</span>
        </span>
      ) : (
        <Image src={word} alt="YukSaroy" sizes="91px" className={`h-[19px] w-auto ${compact ? 'max-sm:hidden' : ''}`} loading="eager" />
      )}
    </span>
  );
}
