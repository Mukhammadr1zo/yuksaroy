-- Murojaat hal qilinganini uchta ustun aytadi: kim, qachon va nima qilingan.
-- Alohida holat ustuni ataylab yo'q: ikki manba bo'lsa ular bir-biriga zid bo'lib
-- qolardi (holat "hal qilindi", sana esa bo'sh). Sana bo'sh bo'lishi "yangi" degani.
--
-- handledById User ga tashqi kalit emas: AuditLog.actorId ham shunday. Admin hisobi
-- o'chirilsa murojaat qatori va uning izohi joyida qolsin.
ALTER TABLE "ContactMessage" ADD COLUMN "handledById" TEXT;
ALTER TABLE "ContactMessage" ADD COLUMN "handledAt" TIMESTAMPTZ(3);
ALTER TABLE "ContactMessage" ADD COLUMN "handledNote" TEXT;

-- Eski qatorlar navbatga tushmaydi: ularga endi hech kim qo'ng'iroq qilmaydi, ya'ni
-- ekrandagi son hech qanday qarorga xizmat qilmasdi. Bundan tashqari bosh sahifadagi
-- "eng uzog'i N kundan beri kutmoqda" belgisi barcha navbatlarning eng eskisini oladi:
-- backfillsiz u birinchi kundanoq qizil bo'lib qotib qolardi.
-- handledById bo'sh qoladi: kim ekanini hech kim bilmaydi, uydirma yozilmaydi.
UPDATE "ContactMessage" SET "handledAt" = "createdAt";

-- Indeks yo'q va bu ataylab: jadvalda ilgari ham indeks yo'q edi va butun ro'yxat
-- ko'rib chiqilardi. ponytail: bir necha ming qatordan oshsa qisman indeks qo'shiladi
-- CREATE INDEX "ContactMessage_new_idx" ON "ContactMessage"("createdAt") WHERE "handledAt" IS NULL;
