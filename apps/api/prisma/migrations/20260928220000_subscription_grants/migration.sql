-- Obuna nimani ochadi. Bo'sh ro'yxat hech narsani ochmaydi, shuning uchun mavjud
-- qatorlarga ikkalasi ham yoziladi: bugungi obunachilar hech narsa sezmaydi va
-- kodda "eski qatormi" degan shart kerak bo'lmaydi.
--
-- NOT NULL yo'q: Prisma ro'yxatli ustunni aynan shunday yasaydi (boshqa TEXT[]
-- ustunlar ham shu ko'rinishda), ya'ni sxema bilan baza bir xil qoladi.
ALTER TABLE "Subscription" ADD COLUMN "grants" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "Subscription" SET "grants" = ARRAY['PHONE', 'WAGON'];
