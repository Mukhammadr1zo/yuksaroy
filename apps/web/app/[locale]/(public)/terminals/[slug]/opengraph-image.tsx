import { ImageResponse } from 'next/og';
import { sapiOrNull } from '@/lib/server-api';
import type { TerminalDetail } from '@/lib/types';

// Terminal og:image: brend rangi + terminal nomi va stansiyasi (lotin). Terminal topilmasa umumiy rasm ishlaydi.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'YukSaroy';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await sapiOrNull<TerminalDetail>(`/terminals/${slug}`, 300).catch(() => null);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#002352', color: 'white', padding: 80 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#077F84' }} />
          <div style={{ fontSize: 36, fontWeight: 700 }}>YukSaroy</div>
        </div>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>{t?.name ?? 'Terminal'}</div>
        <div style={{ display: 'flex', fontSize: 30, color: '#8FB3D9' }}>{t ? `${t.station.nameUz} · ${t.address ?? 'yuksaroy.uz'}` : 'yuksaroy.uz'}</div>
      </div>
    ),
    size,
  );
}
