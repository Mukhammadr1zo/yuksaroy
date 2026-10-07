import type { TerminalKind } from '@yuksaroy/domain';

/**
 * Karta rasmi. Reestrdan kelgan 1700 dan ortiq obyektning birortasida ham rasm yo'q,
 * ya'ni "rasmsiz" holat istisno emas, asosiy holat. Shuning uchun bo'sh kulrang to'rtburchak
 * o'rniga turiga mos chizma turadi: temir yo'lda relslar, avtoda yo'l, aralashda ikkalasi.
 * Chizma ichki SVG: tashqi fayl ham, rasm so'rovi ham yo'q.
 */

// Har karta bir xil ko'rinmasin: slugdan barqaror rang (SSR va klientda bir xil natija)
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const SKIES = [['#0E3A4A', '#12566B'], ['#123A52', '#17607F'], ['#0F3F45', '#166B66'], ['#14304A', '#1B5473']] as const;

/**
 * Kartadagi surat manzili. Karta suratni eng ko'pi 112x84 da chizadi, namuna surat esa
 * 1200 px li va 80-250 KB: xarita ro'yxati shu sababli megabaytlab yuklardi. Namuna
 * suratlarning kichik nusxasi public/demo/thumb da (336x252 ni to'liq qoplaydi, ya'ni 3x
 * ekranda ham xira emas, o'rtacha 17 KB). Yuklangan fayllarning kichik nusxasi yo'q, ular
 * o'zgarmaydi. Yangi namuna surat qo'shilsa thumb dagi nusxasi ham qo'shilsin.
 */
export const cardSrc = (url: string) => url.replace(/^\/demo\/([\w-]+\.jpg)$/, '/demo/thumb/$1');

export function CardPhoto({ kind, slug, photo, alt = '', className = '' }: { kind: TerminalKind; slug: string; photo?: string | null; className?: string; alt?: string }) {
  // lazy: ro'yxatda va xarita yon panelida o'nlab karta, ekrandan tashqaridagisi kutib tursin
  if (photo) return <img src={cardSrc(photo)} alt={alt} loading="lazy" decoding="async" className={`h-full w-full object-cover ${className}`} />;
  const i = hash(slug) % SKIES.length;
  const [top, bottom] = SKIES[i]!;
  const id = `cp${i}`;
  return (
    <svg viewBox="0 0 96 72" className={`h-full w-full ${className}`} role="img" aria-label={alt} aria-hidden={!alt} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="96" height="72" fill={`url(#${id}s)`} />
      {/* Ufq: uzoqdagi tepaliklar, keyin yer */}
      <path d="M0 40 L18 33 L34 39 L52 31 L70 38 L96 32 V72 H0 Z" fill="#0A2733" opacity="0.55" />
      <rect y="46" width="96" height="26" fill="#0A222C" opacity="0.7" />
      {kind === 'RAIL' || kind === 'MULTI' ? <Rails y={kind === 'MULTI' ? 51 : 56} /> : null}
      {kind === 'ROAD' || kind === 'MULTI' ? <Road y={kind === 'MULTI' ? 65 : 58} /> : null}
      {/* Kran siluetlari: yuk terminalining eng tanilgan belgisi */}
      <g stroke="#3FBFC6" strokeWidth="1.6" fill="none" opacity="0.85">
        <path d="M12 46 V26 M12 26 H32 M12 31 L24 26" />
        <path d="M76 46 V30 M76 30 H60 M76 34 L66 30" />
      </g>
      <circle cx="24" cy="26" r="1.4" fill="#F2B24C" />
      <circle cx="66" cy="30" r="1.4" fill="#F2B24C" />
    </svg>
  );
}

function Rails({ y }: { y: number }) {
  return (
    <g>
      {/* Shpallar perspektivada: pastga tomon kengayadi */}
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={2 + i * 11} y={y - 1.5} width="7" height="2.4" rx="0.6" fill="#1D4652" />
      ))}
      <rect x="0" y={y - 3} width="96" height="1.2" fill="#8FD3D8" opacity="0.9" />
      <rect x="0" y={y + 1.6} width="96" height="1.2" fill="#8FD3D8" opacity="0.9" />
    </g>
  );
}

function Road({ y }: { y: number }) {
  return (
    <g>
      <rect x="0" y={y - 3.5} width="96" height="8" fill="#16333F" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={3 + i * 12} y={y} width="6" height="1.2" rx="0.6" fill="#E8EDEE" opacity="0.7" />
      ))}
    </g>
  );
}
