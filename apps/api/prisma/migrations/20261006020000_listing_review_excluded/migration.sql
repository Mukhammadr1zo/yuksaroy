-- E'lon izohi: o'z e'loniga yozilgan eski baho qoladi, lekin reytingga kirmaydi.
-- Egasi 2026-10-06 da tasdiqladi.
--
-- Nega: 2026-10-03 gacha "o'ziga o'zi baho qo'ymasin" qorovuli tashkilot e'lonida
-- ishlamasdi (u yerda ownerUserId doim bo'sh), ya'ni xodim o'z tashkiloti e'loniga baho
-- qo'ya olardi. Qorovul kodda tuzatildi, lekin eski ball Listing.ratingAvg va
-- ratingCount ga singib ketgan va o'zi hech qachon tuzalmaydi.
--
-- Egasi o'chirishni emas, terminal bahosidagi qoidani tanladi (Review.excluded): izoh
-- ko'rinib turadi, reytingdan chiqadi. Yangi o'z bahosi esa avvalgidek SELF_REVIEW bilan
-- rad etiladi: ikki qoida ataylab har xil.

ALTER TABLE "ListingReview" ADD COLUMN "excluded" BOOLEAN NOT NULL DEFAULT false;

-- 1) O'z tomoni: e'lonning yakka egasi yoki e'lon tashkilotining a'zosi. Shart
--    listing-reviews.service dagi ownSide bilan aynan bir xil.
UPDATE "ListingReview" r
SET "excluded" = true
FROM "Listing" l
WHERE r."listingId" = l."id"
  AND (r."userId" = l."ownerUserId"
       OR EXISTS (SELECT 1 FROM "Membership" m WHERE m."orgId" = l."orgId" AND m."userId" = r."userId"));

-- 2) Shu e'lonlarda o'rtacha va son qolgan bahodan qaytadan hisoblanadi. Formula admin
--    izohni o'chirgandagi bilan bir: Math.round(avg * 100) / 100, baho qolmasa 0 va 0.
--    Prisma _avg ham Postgres AVG ni double ga o'giradi. ROUND ishlatilmaydi, ikkala
--    shakli ham ilovadan farq qiladi: numeric da 40 ta bahoning 4.225 o'rtachasi 4.23
--    bo'ladi (ilovada 4.22), double da juftga yaxlitlab 8 ta bahoning 4.125 i 4.12
--    bo'ladi (ilovada 4.13). FLOOR(x + 0.5) esa 1..400 ta bahoning har bir yig'indisida
--    ilova bilan bir xil chiqdi.
--    updatedAt ga tegilmaydi: e'lon "yaqinda yangilangan" bo'lib ko'rinmasin.
UPDATE "Listing" l
SET "ratingAvg" = s.ravg, "ratingCount" = s.rcnt
FROM (
  SELECT l2."id" AS id,
         COALESCE(FLOOR(AVG(r."rating")::double precision * 100 + 0.5) / 100, 0) AS ravg,
         COUNT(r."id")::int AS rcnt
  FROM "Listing" l2
  LEFT JOIN "ListingReview" r ON r."listingId" = l2."id" AND NOT r."excluded"
  WHERE EXISTS (SELECT 1 FROM "ListingReview" x WHERE x."listingId" = l2."id" AND x."excluded")
  GROUP BY l2."id"
) s
WHERE l."id" = s.id;
