-- CreateEnum
CREATE TYPE "Rju" AS ENUM ('TAS', 'KOK', 'BUX', 'KUN', 'KAR', 'TER');

-- CreateEnum
CREATE TYPE "TerminalKind" AS ENUM ('YARD', 'CONTAINER', 'LC', 'SVX');

-- CreateEnum
CREATE TYPE "TerminalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ServiceCode" AS ENUM ('LOAD', 'UNLOAD', 'WEIGH', 'STORAGE', 'SVX', 'CONTAINER', 'LAST_MILE', 'SHUNTING');

-- CreateEnum
CREATE TYPE "TariffUnit" AS ENUM ('PER_TON', 'PER_WAGON', 'PER_OPERATION', 'PER_DAY');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "esrCode" TEXT,
    "nameUz" TEXT NOT NULL,
    "nameRu" TEXT,
    "rju" "Rju" NOT NULL,
    "stationType" TEXT,
    "classRank" TEXT,
    "isTariff" BOOLEAN NOT NULL DEFAULT true,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeTo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameUz" TEXT,
    "groupCode" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,

    CONSTRAINT "CargoType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Siding" (
    "id" TEXT NOT NULL,
    "registryNo" INTEGER NOT NULL,
    "stationId" TEXT,
    "stationNameRaw" TEXT NOT NULL,
    "esrCode" TEXT,
    "rju" "Rju",
    "ownerNameRaw" TEXT NOT NULL,
    "ownerOrgId" TEXT,
    "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'NONE',
    "claimedAt" TIMESTAMPTZ(3),
    "lengthM" INTEGER,
    "unloadCapacity" INTEGER NOT NULL DEFAULT 0,
    "loadCapacity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Siding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Terminal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "stationId" TEXT NOT NULL,
    "kind" "TerminalKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "is24h" BOOLEAN NOT NULL DEFAULT false,
    "hours" JSONB,
    "passport" JSONB,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "TerminalStatus" NOT NULL DEFAULT 'DRAFT',
    "claimedAt" TIMESTAMPTZ(3),
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Terminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminalService" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "serviceCode" "ServiceCode" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "leadTimeMin" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TerminalService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "serviceCode" "ServiceCode" NOT NULL,
    "cargoGroupCode" TEXT,
    "version" INTEGER NOT NULL,
    "validFrom" TIMESTAMPTZ(3) NOT NULL,
    "validTo" TIMESTAMPTZ(3),
    "priceTiyin" BIGINT NOT NULL,
    "unit" "TariffUnit" NOT NULL,
    "minTiyin" BIGINT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Station_esrCode_key" ON "Station"("esrCode");

-- CreateIndex
CREATE INDEX "Station_nameUz_idx" ON "Station"("nameUz");

-- CreateIndex
CREATE INDEX "Station_rju_idx" ON "Station"("rju");

-- CreateIndex
CREATE UNIQUE INDEX "CargoType_code_key" ON "CargoType"("code");

-- CreateIndex
CREATE INDEX "CargoType_name_idx" ON "CargoType"("name");

-- CreateIndex
CREATE INDEX "CargoType_groupCode_idx" ON "CargoType"("groupCode");

-- CreateIndex
CREATE UNIQUE INDEX "Siding_registryNo_key" ON "Siding"("registryNo");

-- CreateIndex
CREATE INDEX "Siding_stationId_idx" ON "Siding"("stationId");

-- CreateIndex
CREATE INDEX "Siding_esrCode_idx" ON "Siding"("esrCode");

-- CreateIndex
CREATE INDEX "Siding_ownerOrgId_idx" ON "Siding"("ownerOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "Terminal_slug_key" ON "Terminal"("slug");

-- CreateIndex
CREATE INDEX "Terminal_stationId_idx" ON "Terminal"("stationId");

-- CreateIndex
CREATE INDEX "Terminal_status_kind_idx" ON "Terminal"("status", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "TerminalService_terminalId_serviceCode_key" ON "TerminalService"("terminalId", "serviceCode");

-- CreateIndex
CREATE INDEX "Tariff_terminalId_serviceCode_validFrom_idx" ON "Tariff"("terminalId", "serviceCode", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_terminalId_serviceCode_version_key" ON "Tariff"("terminalId", "serviceCode", "version");

-- AddForeignKey
ALTER TABLE "Siding" ADD CONSTRAINT "Siding_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Siding" ADD CONSTRAINT "Siding_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalService" ADD CONSTRAINT "TerminalService_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tarif davrlari kesishmasin: terminal × xizmat × yuk guruhi (NULL = '') × [validFrom, validTo)
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_no_overlap"
  EXCLUDE USING gist (
    "terminalId" WITH =,
    "serviceCode" WITH =,
    COALESCE("cargoGroupCode", '') WITH =,
    tstzrange("validFrom", "validTo", '[)') WITH &&
  );
-- rollback: ALTER TABLE "Tariff" DROP CONSTRAINT "Tariff_no_overlap";
