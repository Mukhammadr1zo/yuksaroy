-- Xizmatlar markazi, yuk bozori, vagon qidiruvi va namuna bayroqlari.

ALTER TABLE "Listing" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ServiceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "serviceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceYears" INTEGER,
    "priceNote" TEXT,
    "contactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ServiceProfile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceProfile_serviceType_status_createdAt_idx" ON "ServiceProfile"("serviceType", "status", "createdAt");
CREATE INDEX "ServiceProfile_userId_idx" ON "ServiceProfile"("userId");
ALTER TABLE "ServiceProfile" ADD CONSTRAINT "ServiceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceProfile" ADD CONSTRAINT "ServiceProfile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE SEQUENCE market_no_seq START 1001;

CREATE TABLE "MarketRequest" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "serviceType" TEXT,
    "regionCode" TEXT,
    "fromRegion" TEXT,
    "toRegion" TEXT,
    "fromText" TEXT,
    "toText" TEXT,
    "cargoName" TEXT,
    "weightT" DOUBLE PRECISION,
    "loadDate" DATE,
    "truckType" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contactPhone" TEXT,
    "createdById" TEXT NOT NULL,
    "orgId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "awardedOfferId" TEXT,
    "statusToken" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "MarketRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketRequest_no_key" ON "MarketRequest"("no");
CREATE UNIQUE INDEX "MarketRequest_statusToken_key" ON "MarketRequest"("statusToken");
CREATE INDEX "MarketRequest_board_status_createdAt_idx" ON "MarketRequest"("board", "status", "createdAt");
CREATE INDEX "MarketRequest_board_fromRegion_toRegion_idx" ON "MarketRequest"("board", "fromRegion", "toRegion");
CREATE INDEX "MarketRequest_createdById_idx" ON "MarketRequest"("createdById");
ALTER TABLE "MarketRequest" ADD CONSTRAINT "MarketRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MarketOffer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerOrgId" TEXT,
    "priceTiyin" BIGINT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketOffer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketOffer_requestId_providerUserId_key" ON "MarketOffer"("requestId", "providerUserId");
CREATE INDEX "MarketOffer_providerUserId_idx" ON "MarketOffer"("providerUserId");
ALTER TABLE "MarketOffer" ADD CONSTRAINT "MarketOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MarketRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WagonSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wagonNo" TEXT NOT NULL,
    "found" BOOLEAN NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WagonSearch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WagonSearch_userId_createdAt_idx" ON "WagonSearch"("userId", "createdAt");
CREATE INDEX "WagonSearch_wagonNo_createdAt_idx" ON "WagonSearch"("wagonNo", "createdAt");
ALTER TABLE "WagonSearch" ADD CONSTRAINT "WagonSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
