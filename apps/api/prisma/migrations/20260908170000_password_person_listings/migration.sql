-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "ownerUserId" TEXT,
ALTER COLUMN "orgId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLogins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMPTZ(3),
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "passwordSetAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "Listing_ownerUserId_status_idx" ON "Listing"("ownerUserId", "status");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Egasi: tashkilot yoki yakka shaxs, kamida bittasi
ALTER TABLE "Listing" ADD CONSTRAINT listing_owner CHECK ("orgId" IS NOT NULL OR "ownerUserId" IS NOT NULL);
