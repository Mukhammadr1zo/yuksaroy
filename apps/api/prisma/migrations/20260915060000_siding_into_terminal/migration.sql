-- Shahobcha yo'l terminalga ko'chadi.
--
-- G'oya: shahobcha yo'l ham yuk terminali, faqat temir yo'l turi. Shuning uchun Siding
-- jadvali Terminal ichiga qo'shiladi va yopiladi. Terminal turi endi transport bo'yicha:
-- RAIL (temir yo'l), ROAD (avto), MULTI (ikkisi ham). Eski inshoot turlari (yuk saroyi,
-- konteyner, logistika markazi, SVX) tur emas, xizmat orqali beriladi.
--
-- Tartib muhim: avval ustunlar, keyin ma'lumot ko'chishi, keyin enum almashuvi,
-- eng oxirida Siding o'chadi. Shunda hech qaysi bosqichda bog'lanish uzilmaydi.

-- ─── 1. Terminal: temir yo'l pasporti ustunlari ──────────────────────────────
ALTER TABLE "Terminal" ADD COLUMN "taminotId" INTEGER;
ALTER TABLE "Terminal" ADD COLUMN "registryNo" INTEGER;
ALTER TABLE "Terminal" ADD COLUMN "registryRef" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "stationNameRaw" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "esrCode" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "rju" "Rju";
ALTER TABLE "Terminal" ADD COLUMN "ownerNameRaw" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "lengthM" INTEGER;
ALTER TABLE "Terminal" ADD COLUMN "trackCount" INTEGER;
ALTER TABLE "Terminal" ADD COLUMN "loadCapacity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Terminal" ADD COLUMN "unloadCapacity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Terminal" ADD COLUMN "capacityWagons" INTEGER;
ALTER TABLE "Terminal" ADD COLUMN "occupiedWagons" INTEGER;
ALTER TABLE "Terminal" ADD COLUMN "deadEndDistanceM" INTEGER;
ALTER TABLE "Terminal" ADD COLUMN "junctionSwitch" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "brakeShoes" INTEGER;
ALTER TABLE "Terminal" ADD COLUMN "nogabarit" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "equipment" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "loadNorm" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "unloadNorm" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "loadFront" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "unloadFront" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "locoType" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "locoNote" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "processingHours" DOUBLE PRECISION;
ALTER TABLE "Terminal" ADD COLUMN "contractNo" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "contractStart" DATE;
ALTER TABLE "Terminal" ADD COLUMN "contractEnd" DATE;
ALTER TABLE "Terminal" ADD COLUMN "contractState" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "category" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "usageType" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "operStatus" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "note" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "contactName" TEXT;
ALTER TABLE "Terminal" ADD COLUMN "contactPhone" TEXT;

-- ─── 2. Enum: eski turlar -> transport turlari ───────────────────────────────
-- Postgres enum qiymatini joyida o'chira olmaydi: yangi tip yasab, ustunni ko'chiramiz.
-- Mavjud yagona terminal "SERGELI YUK SAROY" yuk saroyi: vagon ham, mashina ham qabul
-- qiladi, shuning uchun MULTI. Konteyner va SVX ham aralash ishlaydi -> MULTI.
CREATE TYPE "TerminalKind_new" AS ENUM ('RAIL', 'ROAD', 'MULTI');

ALTER TABLE "Terminal" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Terminal"
  ALTER COLUMN "kind" TYPE "TerminalKind_new"
  USING (CASE "kind"::text
           WHEN 'YARD'      THEN 'MULTI'
           WHEN 'CONTAINER' THEN 'MULTI'
           WHEN 'LC'        THEN 'MULTI'
           WHEN 'SVX'       THEN 'MULTI'
           ELSE 'MULTI'
         END)::"TerminalKind_new";

DROP TYPE "TerminalKind";
ALTER TYPE "TerminalKind_new" RENAME TO "TerminalKind";

-- ─── 3. Shahobchalarni Terminal ga ko'chirish ───────────────────────────────
-- Slug bu yerda vaqtincha va kafolatlangan noyob ("shahobcha-<id>"); o'qishga qulay,
-- translitli slugni keyingi ma'lumot skripti qo'yadi. Slug UNIQUE bo'lgani uchun
-- vaqtinchasi ham to'qnashmasligi shart.
-- Holat: reestrdagi FAOL -> ACTIVE, YOPIQ -> HIDDEN (katalogda ko'rinmaydi).
-- Stansiyasi yo'q qatorlar ham ko'chadi: ular stationNameRaw bilan qoladi, keyin
-- stansiyasi topilganda bog'lanadi. Buning uchun stationId ixtiyoriy qilinadi.
ALTER TABLE "Terminal" ALTER COLUMN "stationId" DROP NOT NULL;
INSERT INTO "Terminal" (
  id, "orgId", "stationId", kind, slug, name, phone, lat, lng, is24h, photos, status,
  "claimStatus", "claimOrgId", "claimedAt", "regionCode", "createdAt", "updatedAt",
  "taminotId", "registryNo", "registryRef", "stationNameRaw", "esrCode", rju, "ownerNameRaw",
  "lengthM", "trackCount", "loadCapacity", "unloadCapacity", "capacityWagons", "occupiedWagons",
  "deadEndDistanceM", "junctionSwitch", "brakeShoes", nogabarit, equipment,
  "loadNorm", "unloadNorm", "loadFront", "unloadFront", "locoType", "locoNote",
  "processingHours", "contractNo", "contractStart", "contractEnd", "contractState",
  category, "usageType", "operStatus", note
)
SELECT
  s.id,
  -- Egasi faqat da'vo TASDIQLANGANDA yoziladi. Eski Siding oqimida da'vogar ham ownerOrgId da turardi,
  -- shuning uchun to'g'ridan-to'g'ri ko'chirilsa PENDING va REJECTED qatorlar "egasi bor" bo'lib qolardi.
  CASE WHEN s."claimStatus" = 'APPROVED' THEN s."ownerOrgId" END,
  s."stationId",
  'RAIL'::"TerminalKind",
  'shahobcha-' || s.id,                   -- vaqtincha noyob slug; chiroylisini keyingi skript qo'yadi
  coalesce(nullif(trim(s.name), ''), nullif(trim(s."ownerNameRaw"), ''), s."stationNameRaw", 'Shahobcha'),
  NULL,
  s.lat, s.lng, false, s.photos,
  CASE s.status WHEN 'YOPIQ' THEN 'HIDDEN'::"TerminalStatus" ELSE 'ACTIVE'::"TerminalStatus" END,
  -- claimOrgId: hali hal qilinmagan da'vogar; claimedAt: faqat tasdiqlangan egalikning sanasi.
  -- Egasi tashkiloti o'chib ketgan bo'lsa (ownerOrgId NULL) "tasdiqlangan" deb ko'chirib bo'lmaydi:
  -- egasiz APPROVED qatorni na da'vo qilish, na tuzatish mumkin bo'lardi, shuning uchun NONE ga qaytadi.
  CASE WHEN s."claimStatus" = 'APPROVED' AND s."ownerOrgId" IS NULL THEN 'NONE'::"ClaimStatus" ELSE s."claimStatus" END,
  CASE WHEN s."claimStatus" = 'PENDING' THEN s."ownerOrgId" END,
  CASE WHEN s."claimStatus" = 'APPROVED' THEN s."claimedAt" END,
  s."regionCode", s."createdAt", s."updatedAt",
  s."taminotId", s."registryNo", s."registryRef", s."stationNameRaw", s."esrCode", s.rju, s."ownerNameRaw",
  s."lengthM", s."trackCount", s."loadCapacity", s."unloadCapacity", s."capacityWagons", s."occupiedWagons",
  s."deadEndDistanceM", s."junctionSwitch", s."brakeShoes", s.nogabarit, s.equipment,
  s."loadNorm", s."unloadNorm", s."loadFront", s."unloadFront", s."locoType", s."locoNote",
  s."processingHours", s."contractNo", s."contractStart", s."contractEnd", s."contractState",
  s.category, s."usageType", s.status::text, s.note
FROM "Siding" s;

-- ─── 4. E'lonlarni ko'chirish ────────────────────────────────────────────────
-- Shahobcha id si terminal id si sifatida saqlanib qolgani uchun bog'lanish to'g'ridan-to'g'ri.
-- `sidingId` shu yerning o'zida bo'shatiladi: `listing_one_object` cheklovi ikkala ustun
-- birdan to'lishiga yo'l qo'ymaydi, faqat `terminalId` ni yozsak qator cheklovga urilardi.
UPDATE "Listing" l SET "terminalId" = l."sidingId", "sidingId" = NULL
WHERE l."sidingId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "Terminal" t WHERE t.id = l."sidingId");

-- ─── 5. Indekslar va cheklovlar ─────────────────────────────────────────────
CREATE UNIQUE INDEX "Terminal_taminotId_key"  ON "Terminal"("taminotId");
CREATE UNIQUE INDEX "Terminal_registryNo_key" ON "Terminal"("registryNo");
CREATE INDEX "Terminal_esrCode_idx" ON "Terminal"("esrCode");

-- ─── 6. Siding jadvali va uning aloqalari yopiladi ──────────────────────────
DROP INDEX IF EXISTS "Listing_sidingId_idx";
ALTER TABLE "Listing" DROP COLUMN IF EXISTS "sidingId";
DROP TABLE "Siding";
