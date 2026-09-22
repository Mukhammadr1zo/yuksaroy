-- Kunlik tashriflar yig'masi. Bitta qator = bitta kun va bitta joy; IP yozilmaydi.
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- day birinchi ustun: "oxirgi N kun" so'rovi ham shu indeksdan foydalanadi,
-- shuning uchun alohida day indeksi qo'shilmaydi
CREATE UNIQUE INDEX "Visit_day_country_region_key" ON "Visit"("day", "country", "region");
