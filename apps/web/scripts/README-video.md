# Ko'rgazma videosi

Sayt ko'rgazmasini (explainer) Telegram va Instagram uchun mp4 qilib yozib oladi.
Video alohida montaj qilinmaydi: manba saytning o'zi, shuning uchun ular ajralib qolmaydi.

Tartib, `apps/web` ichidan:

1. `npx next build`
2. `npx next start -p 3015`
3. Boshqa oynada: `node scripts/explainer-video.mjs uz`

- Birinchi argument til: `uz`, `ru`, `en`. Har biri alohida yuritiladi.
- Ikkinchi argument manzil, sukut `http://localhost:3015`.
- `--telefon` bayrog'i 1080x1350 (Instagram portret) beradi, aks holda 1280x720.
- Natija `apps/web/.video/` ichida: `.mp4` va yonida `.webm` nusxasi. Papka git ga tushmaydi.
- `--banner` bayrog'i o'z reklamamizni yozadi: oyna 1200x150 (8:1), uzunlik 4 soniya, manzil `/explainer/banner`.
- Natija `apps/web/.video/self-ad-<til>-1200x150.mp4` (va `.webm`). Skript hajmni chop etadi; 300 KB dan oshsa ogohlantiradi.
- Panelda ishlatish: Admin > Reklama > Yangi > joy "Pastki banner (hamma sahifa)" > "Banner fayli" ga shu mp4 ni yuklash.
- Panelda e'lonning sarlavha va matn maydoniga ham shu satrni yozing (`Terminal, texnika, tashuvchi`): AdSlot video uchun `alt` bermaydi, ya'ni ekran o'quvchiga faqat shu matn yetadi, aks holda havolaning nomi "Reklama" bo'lib qoladi.
