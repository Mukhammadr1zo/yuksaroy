-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('SHUNTING_LOCO', 'ELECTRIC_LOCO', 'WAGON', 'TRUCK');

-- CreateEnum
CREATE TYPE "DealKind" AS ENUM ('RENT', 'SALE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'ARCHIVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('NEW', 'GOOD', 'NEEDS_REPAIR');

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('TOTAL', 'PER_MONTH', 'PER_DAY', 'PER_HOUR', 'PER_KM', 'PER_TON', 'PER_TRIP');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "description" TEXT,
ADD COLUMN     "kinds" "OrgKind"[] DEFAULT ARRAY[]::"OrgKind"[],
ADD COLUMN     "kycNote" TEXT,
ADD COLUMN     "kycRequestedAt" TIMESTAMPTZ(3),
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "telegram" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "googleSub" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "deal" "DealKind",
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "regionCode" TEXT NOT NULL,
    "terminalId" TEXT,
    "sidingId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "priceTiyin" BIGINT,
    "priceUnit" "PriceUnit",
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "year" INTEGER,
    "condition" "Condition",
    "model" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "wagonType" TEXT,
    "capacityT" INTEGER,
    "truckType" TEXT,
    "tonnage" INTEGER,
    "fleetSize" INTEGER,
    "serviceRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "routes" JSONB,
    "contactPhone" TEXT,
    "responseHours" INTEGER,
    "premiumUntil" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "rejectReason" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "fromOrgId" TEXT,
    "fromUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_slug_key" ON "Listing"("slug");

-- CreateIndex
CREATE INDEX "Listing_status_kind_regionCode_idx" ON "Listing"("status", "kind", "regionCode");

-- CreateIndex
CREATE INDEX "Listing_orgId_status_idx" ON "Listing"("orgId", "status");

-- CreateIndex
CREATE INDEX "Listing_terminalId_idx" ON "Listing"("terminalId");

-- CreateIndex
CREATE INDEX "Listing_sidingId_idx" ON "Listing"("sidingId");

-- CreateIndex
CREATE INDEX "Listing_status_expiresAt_idx" ON "Listing"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Inquiry_listingId_createdAt_idx" ON "Inquiry"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "Inquiry_fromUserId_createdAt_idx" ON "Inquiry"("fromUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sidingId_fkey" FOREIGN KEY ("sidingId") REFERENCES "Siding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Qo'lda: bitta obyekt (terminal yoki shahobcha) va narx bo'lsa birlik shart
ALTER TABLE "Listing" ADD CONSTRAINT "listing_one_object" CHECK ("terminalId" IS NULL OR "sidingId" IS NULL);
ALTER TABLE "Listing" ADD CONSTRAINT "listing_price_unit" CHECK ("priceTiyin" IS NULL OR "priceUnit" IS NOT NULL);

-- Backfill: kinds = [kind]
UPDATE "Organization" SET "kinds" = ARRAY["kind"]::"OrgKind"[] WHERE "kinds" = '{}';

-- Backfill: slug nomdan (lotin harf va raqam), bir xil nomlar id dumi bilan ajratiladi, bo'sh nom uchun 'tashkilot'
WITH s AS (
  SELECT "id", "createdAt",
    coalesce(nullif(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''), 'tashkilot') AS base
  FROM "Organization" WHERE "slug" IS NULL
), n AS (
  SELECT "id", base, row_number() OVER (PARTITION BY base ORDER BY "createdAt", "id") AS rn FROM s
)
UPDATE "Organization" o SET "slug" = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || '-' || right(o."id", 6) END
FROM n WHERE o."id" = n."id";
