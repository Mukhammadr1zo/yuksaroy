-- Platformaning o'z yozuvlari sinov edi. Egasi 2026-10-07 da tasdiqladi ("Ikkalasi sinov").
--
-- Nega: "Yuksaroy MCHJ" tashkiloti tashuvchi bo'lib turardi va yuk so'rovlari unga ham ketardi,
-- ya'ni hech bir haqiqiy tashuvchiga yetmagan so'rov jurnalda "bir odamga ketdi" deb ko'rinardi.
-- "Tonar toshkent" e'loni esa egasining sinov mashinasi: katalogda haqiqiy tashuvchidek turardi.
--
-- Qoidalar:
-- 1. Qator noyob slug VA nomi bilan topiladi: ikkalasi mos kelmasa hech narsa o'zgarmaydi.
--    Boshqa qatorga tegilmaydi.
-- 2. Tashkilotdan faqat CARRIER turi olinadi, qolgan turlari (TERMINAL) va shahobchasi joyida.
--    Asosiy tur (kind) CARRIER bo'lsa qolgan turlarning birinchisi bo'ladi: ilova ham
--    kind = kinds[0] deb yozadi. CARRIER olinganda turi qolmaydigan bo'lsa qator o'zgarmaydi,
--    u holda qarorni ega qiladi. updatedAt ga tegilmaydi (uni Prisma yuritadi), telefon
--    migratsiyasidagi kabi.
-- 3. E'lon ilova arxivlaganidek arxivlanadi: status ARCHIVED, rejectReason bo'sh, updatedAt
--    hozir (listings.usecase archive). Faqat ACTIVE dan: o'tish jadvalida ARCHIVED ga yo'l
--    faqat shundan. Muddat va publishedAt joyida qoladi, egasi xohlasa qayta yuboradi.
-- 4. Ikkinchi marta ishlasa hech narsa qilmaydi: CARRIER yo'q, e'lon esa allaqachon ARCHIVED.

UPDATE "Organization"
SET "kinds" = array_remove("kinds", 'CARRIER'::"OrgKind"),
    "kind" = CASE WHEN "kind" = 'CARRIER'::"OrgKind" THEN (array_remove("kinds", 'CARRIER'::"OrgKind"))[1] ELSE "kind" END
WHERE "slug" = 'yuksaroy-mchj'
  AND "name" = 'Yuksaroy MCHJ'
  AND 'CARRIER'::"OrgKind" = ANY("kinds")
  AND cardinality(array_remove("kinds", 'CARRIER'::"OrgKind")) > 0;

UPDATE "Listing"
SET "status" = 'ARCHIVED'::"ListingStatus",
    "rejectReason" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'tonar-toshkent'
  AND "title" = 'Tonar toshkent'
  AND "status" = 'ACTIVE'::"ListingStatus";
