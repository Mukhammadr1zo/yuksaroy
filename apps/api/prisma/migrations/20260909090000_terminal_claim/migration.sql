-- AlterTable
ALTER TABLE "Terminal" ADD COLUMN     "claimOrgId" TEXT,
ADD COLUMN     "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE INDEX "Terminal_claimStatus_idx" ON "Terminal"("claimStatus");

