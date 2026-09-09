-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('HOLD', 'CONFIRMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('LOCAL', 'IMPORT', 'EXPORT');

-- CreateEnum
CREATE TYPE "CommissionPayer" AS ENUM ('CLIENT', 'TERMINAL');

-- AlterTable
ALTER TABLE "Terminal" ADD COLUMN     "slotConfig" JSONB;

-- CreateTable
CREATE TABLE "TimeSlot" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "window" INTEGER NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "booked" INTEGER NOT NULL DEFAULT 0,
    "held" INTEGER NOT NULL DEFAULT 0,
    "status" "SlotStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlotBooking" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "orderId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'HOLD',
    "holdExpiresAt" TIMESTAMPTZ(3),
    "extendedOnce" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMPTZ(3),
    "releasedAt" TIMESTAMPTZ(3),
    "releaseReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlotBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "shipperOrgId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL DEFAULT 'LOCAL',
    "operation" "ServiceCode" NOT NULL,
    "cargoTypeId" TEXT,
    "weightKg" INTEGER NOT NULL,
    "wagonCount" INTEGER NOT NULL DEFAULT 1,
    "storageDays" INTEGER,
    "wagonNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "subtotalTiyin" BIGINT NOT NULL,
    "commissionPct" INTEGER NOT NULL DEFAULT 0,
    "commissionPayer" "CommissionPayer" NOT NULL DEFAULT 'TERMINAL',
    "commissionTiyin" BIGINT NOT NULL DEFAULT 0,
    "totalTiyin" BIGINT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "slaConfirmUntil" TIMESTAMPTZ(3),
    "confirmedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "serviceCode" "ServiceCode" NOT NULL,
    "tariffId" TEXT,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" "TariffUnit" NOT NULL,
    "unitPriceTiyin" BIGINT NOT NULL,
    "amountTiyin" BIGINT NOT NULL,
    "minApplied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus",
    "code" TEXT,
    "actorId" TEXT,
    "actorRole" TEXT,
    "reason" TEXT,
    "payload" JSONB,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "TimeSlot_terminalId_startsAt_idx" ON "TimeSlot"("terminalId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "TimeSlot_terminalId_localDate_window_key" ON "TimeSlot"("terminalId", "localDate", "window");

-- CreateIndex
CREATE UNIQUE INDEX "SlotBooking_orderId_key" ON "SlotBooking"("orderId");

-- CreateIndex
CREATE INDEX "SlotBooking_slotId_status_idx" ON "SlotBooking"("slotId", "status");

-- CreateIndex
CREATE INDEX "SlotBooking_status_holdExpiresAt_idx" ON "SlotBooking"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "SlotBooking_userId_createdAt_idx" ON "SlotBooking"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_no_key" ON "Order"("no");

-- CreateIndex
CREATE INDEX "Order_shipperOrgId_createdAt_idx" ON "Order"("shipperOrgId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_terminalId_status_slaConfirmUntil_idx" ON "Order"("terminalId", "status", "slaConfirmUntil");

-- CreateIndex
CREATE INDEX "Order_status_slaConfirmUntil_idx" ON "Order"("status", "slaConfirmUntil");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_at_idx" ON "OrderStatusHistory"("orderId", "at");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- AddForeignKey
ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotBooking" ADD CONSTRAINT "SlotBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TimeSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotBooking" ADD CONSTRAINT "SlotBooking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shipperOrgId_fkey" FOREIGN KEY ("shipperOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cargoTypeId_fkey" FOREIGN KEY ("cargoTypeId") REFERENCES "CargoType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Slot sig'imi DB darajasida kafolatlanadi: manfiy bo'lmasin va band+ushlab turilgan sig'imdan oshmasin
ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_capacity_ck"
  CHECK (booked >= 0 AND held >= 0 AND capacity >= 0 AND booked + held <= capacity);
-- rollback: ALTER TABLE "TimeSlot" DROP CONSTRAINT "TimeSlot_capacity_ck";

-- Buyurtma raqami: YS-0001 dan ketma-ket
CREATE SEQUENCE IF NOT EXISTS order_no_seq START 1001;
-- rollback: DROP SEQUENCE order_no_seq;

-- Faol hold'ni tez topish (expiry sweep)
CREATE INDEX "SlotBooking_active_hold_idx" ON "SlotBooking" ("holdExpiresAt") WHERE status = 'HOLD';
-- rollback: DROP INDEX "SlotBooking_active_hold_idx";
