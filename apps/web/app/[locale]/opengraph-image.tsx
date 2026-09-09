import { ImageResponse } from 'next/og';

// Saytning umumiy og:image (1200x630). Statik: matn lotin yozuvida, chunki ImageResponse standart shrifti kirillni tashlab ketishi mumkin.
// Sahifaga xos rasm faqat terminal tafsilotida (terminals/[slug]/opengraph-image.tsx).
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'YukSaroy';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#002352', color: 'white', padding: 80 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#077F84' }} />
          <div style={{ fontSize: 56, fontWeight: 700 }}>YukSaroy</div>
        </div>
        <div style={{ display: 'flex', fontSize: 44, lineHeight: 1.25, color: '#DCE6F2' }}>
          Yuk xizmatlari tizimi: terminal, shahobcha yo'l, texnika, avtotransport
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#8FB3D9' }}>yuksaroy.uz</div>
      </div>
    ),
    size,
  );
}
