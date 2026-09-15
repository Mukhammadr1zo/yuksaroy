-- Elektrovoz e'lon turi olib tashlanadi.
--
-- Platformada elektrovoz ijaraga berilmaydi: kontakt tarmoq talab qiladi va uni
-- xususiy egasi bera olmaydi. Qolgan texnika turlari: manevr teplovozi va vagon.
--
-- Postgres enum qiymatini joyida o'chira olmaydi, shuning uchun yangi tur yaratiladi,
-- ustun unga o'tkaziladi, eskisi yopiladi.

-- Xavfsizlik to'ri: qatorlar bo'lsa (ishlab chiqarishda Listing bo'sh) manevr teplovoziga o'tadi,
-- aks holda USING quyida "invalid input value" bilan yiqilardi.
UPDATE "Listing" SET "kind" = 'SHUNTING_LOCO' WHERE "kind" = 'ELECTRIC_LOCO';

CREATE TYPE "ListingKind_new" AS ENUM ('SHUNTING_LOCO', 'WAGON', 'TRUCK');
ALTER TABLE "Listing" ALTER COLUMN "kind" TYPE "ListingKind_new" USING ("kind"::text::"ListingKind_new");
DROP TYPE "ListingKind";
ALTER TYPE "ListingKind_new" RENAME TO "ListingKind";
