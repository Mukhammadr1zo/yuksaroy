-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "reply" TEXT,
    "repliedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Impression" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "surface" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Impression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiumOrder" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "orgId" TEXT,
    "userId" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "amountTiyin" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PremiumOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderNo_key" ON "Review"("orderNo");

-- CreateIndex
CREATE INDEX "Review_terminalId_createdAt_idx" ON "Review"("terminalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Impression_kind_targetId_day_surface_key" ON "Impression"("kind", "targetId", "day", "surface");

-- CreateIndex
CREATE INDEX "PremiumOrder_listingId_idx" ON "PremiumOrder"("listingId");

-- CreateIndex
CREATE INDEX "PremiumOrder_status_idx" ON "PremiumOrder"("status");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumOrder" ADD CONSTRAINT "PremiumOrder_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

