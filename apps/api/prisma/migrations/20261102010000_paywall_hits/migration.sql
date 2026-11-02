-- To'lov devoriga urilgan odam: bir odam, bir kun, bir devor uchun bitta qator.
-- Ilgari sanoq jarayon xotirasida edi va har deploy nolga qaytarardi (egasi qarori, 2026-11-02).
-- Eski Impression(kind='wall') qatorlari qoladi, lekin o'qilmaydi: ular odam emas, ochilish sanog'i edi.
CREATE TABLE "PaywallHit" (
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaywallHit_pkey" PRIMARY KEY ("userId","kind","day")
);

CREATE INDEX "PaywallHit_kind_day_idx" ON "PaywallHit"("kind", "day");

ALTER TABLE "PaywallHit" ADD CONSTRAINT "PaywallHit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
