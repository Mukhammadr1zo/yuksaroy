-- Shahobcha texnik pasporti: Taminot reestridan (taminot.d-railway.uz) keladigan maydonlar.
-- Mas'ul shaxs ismi va telefoni ataylab olinmaydi: ochiq katalogda shaxsiy aloqa ma'lumoti
-- turmaydi, murojaat platforma orqali ketadi.
ALTER TABLE "Siding" ADD COLUMN "taminotId" INTEGER;
ALTER TABLE "Siding" ADD COLUMN "name" TEXT;
ALTER TABLE "Siding" ADD COLUMN "registryRef" TEXT;
ALTER TABLE "Siding" ADD COLUMN "trackCount" INTEGER;
ALTER TABLE "Siding" ADD COLUMN "capacityWagons" INTEGER;
ALTER TABLE "Siding" ADD COLUMN "occupiedWagons" INTEGER;
ALTER TABLE "Siding" ADD COLUMN "deadEndDistanceM" INTEGER;
ALTER TABLE "Siding" ADD COLUMN "junctionSwitch" TEXT;
ALTER TABLE "Siding" ADD COLUMN "brakeShoes" INTEGER;
ALTER TABLE "Siding" ADD COLUMN "nogabarit" TEXT;
ALTER TABLE "Siding" ADD COLUMN "equipment" TEXT;
ALTER TABLE "Siding" ADD COLUMN "loadNorm" TEXT;
ALTER TABLE "Siding" ADD COLUMN "unloadNorm" TEXT;
ALTER TABLE "Siding" ADD COLUMN "loadFront" TEXT;
ALTER TABLE "Siding" ADD COLUMN "unloadFront" TEXT;
ALTER TABLE "Siding" ADD COLUMN "locoType" TEXT;
ALTER TABLE "Siding" ADD COLUMN "locoNote" TEXT;
ALTER TABLE "Siding" ADD COLUMN "processingHours" DOUBLE PRECISION;
ALTER TABLE "Siding" ADD COLUMN "contractNo" TEXT;
ALTER TABLE "Siding" ADD COLUMN "contractStart" DATE;
ALTER TABLE "Siding" ADD COLUMN "contractEnd" DATE;
ALTER TABLE "Siding" ADD COLUMN "contractState" TEXT;
ALTER TABLE "Siding" ADD COLUMN "category" TEXT;
ALTER TABLE "Siding" ADD COLUMN "usageType" TEXT;
ALTER TABLE "Siding" ADD COLUMN "status" TEXT;
ALTER TABLE "Siding" ADD COLUMN "note" TEXT;

CREATE UNIQUE INDEX "Siding_taminotId_key" ON "Siding"("taminotId");
CREATE INDEX "Siding_status_idx" ON "Siding"("status");

-- registryNo endi majburiy emas: Taminotdan kelgan qatorlarda reestr raqami yo'q,
-- ularning kaliti taminotId.
ALTER TABLE "Siding" ALTER COLUMN "registryNo" DROP NOT NULL;
