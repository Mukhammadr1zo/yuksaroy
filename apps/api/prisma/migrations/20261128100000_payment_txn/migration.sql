-- Online to'lov tranzaksiyalari (Payme, Click, Uzum): egasi qarori 2026-11-28.
-- Obuna to'lov tizimidan "to'landi" kelganda admin tasdig'isiz faollashadi.
CREATE TABLE "PaymentTxn" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "extId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amountTiyin" BIGINT NOT NULL,
    "state" INTEGER NOT NULL DEFAULT 1,
    "reason" INTEGER,
    "providerTime" BIGINT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),

    CONSTRAINT "PaymentTxn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentTxn_provider_extId_key" ON "PaymentTxn"("provider", "extId");
CREATE INDEX "PaymentTxn_subscriptionId_idx" ON "PaymentTxn"("subscriptionId");
CREATE INDEX "PaymentTxn_provider_providerTime_idx" ON "PaymentTxn"("provider", "providerTime");

ALTER TABLE "PaymentTxn" ADD CONSTRAINT "PaymentTxn_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
