import { ImageResponse } from 'next/og';

// Saytning umumiy og:image (1200x630): Telegram, Facebook va qidiruvda havola ko'rinishi.
// Matn lotin yozuvida: ImageResponse standart shrifti kirillni tashlab ketishi mumkin.
// Belgi fayldan emas, data URI dan olinadi - ImageResponse fayl tizimiga murojaat qilmaydi
// va standalone konteynerda yo'l farq qilmaydi. Manba: public/img/logo-mark.png (96 px).
// Belgi navy va teal ranglardan iborat, shuning uchun to'q fonda oq plastina ustiga qo'yiladi.
const MARK = 'data:image/png;base64,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';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'YukSaroy';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#002352', color: 'white', padding: 80 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 104, height: 104, borderRadius: 26, background: 'white' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARK} width={80} height={80} alt="" />
          </div>
          <div style={{ display: 'flex', fontSize: 60, fontWeight: 700 }}>
            <span>Yuk<span style={{ color: '#05979E' }}>Saroy</span></span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, lineHeight: 1.15 }}>
            Yuk terminallari, shahobcha yo'llar, texnika va avtotransport
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: '#8FB3D9' }}>
            Egasini toping, to'g'ridan-to'g'ri bog'laning
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#8FB3D9' }}>yuksaroy.uz</div>
      </div>
    ),
    size,
  );
}
