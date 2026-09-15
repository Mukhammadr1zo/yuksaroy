-- Stansiya: inglizcha nom va rasmiy ro'yxat bayrog'i.
-- nameEn: uch tilli katalog uchun (uz/ru/en), manba Taminot va uzrailmap bazalari.
-- isListed: "2026 yil stansiyalar" hujjatidagi rasmiy ro'yxatda bormi. Xarita va katalog
-- faqat shu qatorlarni ko'rsatadi. Ro'yxatdan tashqari qatorlar o'chirilmaydi, chunki
-- ularga shahobcha yoki terminal bog'langan bo'lishi mumkin.
ALTER TABLE "Station" ADD COLUMN "nameEn" TEXT;
ALTER TABLE "Station" ADD COLUMN "isListed" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Station_isListed_idx" ON "Station"("isListed");
