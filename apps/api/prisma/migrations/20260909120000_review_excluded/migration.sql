-- AlterTable
-- Halol reyting: o'z-o'ziga berilgan baho (arms-length buzilishi) sharh sifatida qoladi, reytingga kirmaydi.
ALTER TABLE "Review" ADD COLUMN "excluded" BOOLEAN NOT NULL DEFAULT false;
