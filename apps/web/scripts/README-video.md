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
