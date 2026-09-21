-- Foydalanuvchi obunasi. Premium bitta e'longa tegishli edi, obuna esa odamga:
-- telefon raqamini ko'rish va vagon qidiruvi shu bilan ochiladi. To'lov hozircha
-- qo'lda, admin tasdiqlaydi (PremiumOrder bilan bir xil yo'l).
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "amountTiyin" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Subscription_userId_endsAt_idx" ON "Subscription"("userId", "endsAt");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
