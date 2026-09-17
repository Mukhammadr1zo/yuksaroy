-- Yozishma endi terminalga ham tegishli bo'ladi va xabarga fayl biriktiriladi.
-- Sabab: katalogdagi terminal egasiga faqat telefon orqali murojaat qilish mumkin edi,
-- xabarda esa faqat matn yuborilardi (hujjat, tarozi dalolatnomasi, foto ilova qilinmasdi).

-- 1) Mavzu: e'lon yoki terminal. Eski qatorlarda listingId to'la, shuning uchun NOT NULL olib tashlanadi.
ALTER TABLE "Inquiry" ALTER COLUMN "listingId" DROP NOT NULL;
ALTER TABLE "Inquiry" ADD COLUMN "terminalId" TEXT;

-- 2) Qabul qiluvchi yaratilganda qotiriladi: obyekt egasi keyin almashsa eski yozishma ochilmaydi.
ALTER TABLE "Inquiry" ADD COLUMN "toOrgId" TEXT;
ALTER TABLE "Inquiry" ADD COLUMN "toUserId" TEXT;
ALTER TABLE "Inquiry" ADD COLUMN "toPlatform" BOOLEAN NOT NULL DEFAULT false;

-- 3) Xabar ilovalari: [{ url, name, size, mime }]
ALTER TABLE "InquiryMessage" ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '[]';

-- 4) Mavjud yozishmalarga qabul qiluvchini e'londan ko'chirish.
UPDATE "Inquiry" i
SET "toOrgId" = l."orgId", "toUserId" = l."ownerUserId"
FROM "Listing" l
WHERE l."id" = i."listingId";

ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_terminalId_fkey"
  FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Inquiry_terminalId_createdAt_idx" ON "Inquiry"("terminalId", "createdAt");
CREATE INDEX "Inquiry_toOrgId_lastMessageAt_idx" ON "Inquiry"("toOrgId", "lastMessageAt");
CREATE INDEX "Inquiry_toUserId_lastMessageAt_idx" ON "Inquiry"("toUserId", "lastMessageAt");
CREATE INDEX "Inquiry_toPlatform_lastMessageAt_idx" ON "Inquiry"("toPlatform", "lastMessageAt");

-- 5) Ro'yxat oxirgi xabar bo'yicha tartiblanadi; eski qatorlarda u bo'sh bo'lsa ochilish vaqti olinadi.
UPDATE "Inquiry" SET "lastMessageAt" = "createdAt" WHERE "lastMessageAt" IS NULL;
