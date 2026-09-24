-- Kuzatuv: odam bo'sh natija ekranida "chiqqanda xabar bering" deb bosgan shart.
-- params JSONB, chunki ikki xil tur (yuk va e'lon) bir-biridan farq qiladigan
-- maydonlar bilan yuradi; ular hech qachon alohida qidirilmaydi, faqat
-- xotirada solishtiriladi.
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "lastSentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watch_pkey" PRIMARY KEY ("id")
);

-- Hodisada faqat shu tur va bugun xabar bermagan qatorlar o'qiladi:
-- ikkala shart ham shu indeksdan foydalanadi
CREATE INDEX "Watch_kind_lastSentAt_idx" ON "Watch"("kind", "lastSentAt");
CREATE INDEX "Watch_userId_idx" ON "Watch"("userId");

ALTER TABLE "Watch" ADD CONSTRAINT "Watch_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
