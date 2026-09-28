-- Yon tomondagi reklama. Uchinchi tomon kodisiz: qator bizning bazamizda turadi.
CREATE TABLE "AdPlacement" (
  "id" TEXT NOT NULL,
  "placement" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "imageUrl" TEXT,
  "href" TEXT NOT NULL,
  "buyer" TEXT,
  "pricePaidSom" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AdPlacement_pkey" PRIMARY KEY ("id")
);

-- Ommaviy so'rov aynan shu to'rt ustun bo'yicha qidiradi
CREATE INDEX "AdPlacement_placement_status_startsAt_endsAt_idx"
  ON "AdPlacement"("placement", "status", "startsAt", "endsAt");
