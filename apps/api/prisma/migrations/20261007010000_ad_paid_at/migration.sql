-- Reklamaning to'langan sanasi: tushum reklama pulini to'langan oyga yozadi.
-- Egasi 2026-10-07 da tasdiqladi.
--
-- Nega: ilgari pul reklama boshlangan oyga (startsAt) tushardi va eski qatorga yozilgan
-- uzaytirish birinchi oyga ketib qolardi.
-- Ixtiyoriy ustun, mavjud qatorlarga tegilmaydi: bo'sh paidAt li qator avvalgidek boshlangan
-- oyiga yoziladi, ya'ni o'tgan oylarning tushumi o'zgarmaydi.
-- Indeks qo'shilmadi: jadvalda yiliga o'nlab qator.
ALTER TABLE "AdPlacement" ADD COLUMN "paidAt" TIMESTAMPTZ(3);
