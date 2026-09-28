-- Xizmat profili va bozor so'roviga surat: e'lon bilan bir xil ustun turi.
-- Prisma ro'yxat ustunini NOT NULL siz yaratadi, shu sababli bu yerda ham yo'q.
ALTER TABLE "ServiceProfile" ADD COLUMN "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MarketRequest" ADD COLUMN "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
