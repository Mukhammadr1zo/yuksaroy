-- Yuk so'roviga narx aytishga yordam beradigan uch maydon. Hammasi ixtiyoriy:
-- mavjud qatorlarga tegilmaydi va ma'lumot ko'chirilmaydi.
ALTER TABLE "MarketRequest" ADD COLUMN "volumeM3" DOUBLE PRECISION;
ALTER TABLE "MarketRequest" ADD COLUMN "trucksCount" INTEGER;
ALTER TABLE "MarketRequest" ADD COLUMN "paymentTerm" TEXT;
