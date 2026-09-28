-- Obuna tarifi: narxi, nimani ochishi va chegaralari. Admin yoki moderator yaratadi.
-- Tarif yo'q bo'lsa tizim eskicha ishlaydi, ya'ni bu qatlam majburiy emas.
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "priceMonthSom" INTEGER NOT NULL,
    "grants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "limits" JSONB,
    "maxMonths" INTEGER NOT NULL DEFAULT 12,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");
CREATE INDEX "Plan_active_sort_idx" ON "Plan"("active", "sort");

-- Obuna qaysi tarifdan olingani va o'sha paytdagi chegaralar nusxasi.
-- Tarif o'chsa obuna qolaveradi: shartlari qator ichida yozilgan.
ALTER TABLE "Subscription" ADD COLUMN "planId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "limits" JSONB;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
