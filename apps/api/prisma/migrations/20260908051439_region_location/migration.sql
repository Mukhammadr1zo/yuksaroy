-- AlterTable
ALTER TABLE "Siding" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "regionCode" TEXT;

-- AlterTable
ALTER TABLE "Terminal" ADD COLUMN     "regionCode" TEXT;
