-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "storefront" JSONB;

-- CreateTable
CREATE TABLE "UrgentRequest" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "stationName" TEXT,
    "wagonCount" INTEGER,
    "description" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "orgId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "awardedOfferId" TEXT,
    "statusToken" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UrgentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrgentOffer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "providerOrgId" TEXT,
    "providerUserId" TEXT NOT NULL,
    "priceTiyin" BIGINT,
    "etaMinutes" INTEGER,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UrgentOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UrgentRequest_no_key" ON "UrgentRequest"("no");

-- CreateIndex
CREATE UNIQUE INDEX "UrgentRequest_statusToken_key" ON "UrgentRequest"("statusToken");

-- CreateIndex
CREATE INDEX "UrgentRequest_status_regionCode_idx" ON "UrgentRequest"("status", "regionCode");

-- CreateIndex
CREATE INDEX "UrgentRequest_createdById_idx" ON "UrgentRequest"("createdById");

-- CreateIndex
CREATE INDEX "UrgentOffer_requestId_idx" ON "UrgentOffer"("requestId");

-- AddForeignKey
ALTER TABLE "UrgentOffer" ADD CONSTRAINT "UrgentOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "UrgentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Shoshilinch so'rov raqami: 'UR-' + seq (buyurtmadagi order_no_seq kabi)
CREATE SEQUENCE IF NOT EXISTS urgent_no_seq START 1001;
