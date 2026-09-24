-- To'lov izohiga yoziladigan obuna buyurtma raqami: 'PAY-' + seq (buyurtmadagi naqsh bilan bir xil).
-- Cuid ni odam bank izohiga ko'chira olmasdi, operator esa ko'chirmadan qatorni topa olmasdi.
CREATE SEQUENCE IF NOT EXISTS pay_no_seq START 1001;

ALTER TABLE "Subscription" ADD COLUMN "no" TEXT;

-- Mavjud qatorlar: eski buyurtma kichik raqam olsin
UPDATE "Subscription" s
SET "no" = 'PAY-' || (1000 + r.n)
FROM (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n FROM "Subscription") r
WHERE s."id" = r."id";

-- Ketma-ketlik backfill dan keyin davom etsin, aks holda keyingi buyurtma takror raqam olardi
SELECT setval('pay_no_seq', 1000 + (SELECT count(*) FROM "Subscription"), true);

ALTER TABLE "Subscription" ALTER COLUMN "no" SET NOT NULL;
CREATE UNIQUE INDEX "Subscription_no_key" ON "Subscription"("no");
