-- SOLANUZ shahobchasiga (sergeli-shahobcha-61) "Yuksaroy MCHJ" ning da'vosi sinov edi.
-- Egasi 2026-10-07 da tasdiqladi. Admin da'voni rad etgan, lekin orgId qolib ketgan edi
-- (rad etishda egalik tozalanmasdi, kodda shu bilan tuzatildi), shuning uchun obyekt hamon
-- "egasi bor" ko'rinardi.
--
-- Qoidalar:
-- 1. Qator noyob slug VA hozirgi egasi yuksaroy-mchj bo'lgani bilan topiladi. Ikkalasi mos
--    kelmasa (masalan haqiqiy egasi da'vo qilib olgan bo'lsa) hech narsa o'zgarmaydi.
-- 2. Obyekt "hech kim da'vo qilmagan" holatiga qaytadi: ilova shunday yozadi (claimStatus NONE,
--    orgId, claimOrgId, claimedAt va dalil bo'sh). updatedAt ga tegilmaydi, uni Prisma yuritadi.
-- 3. Ikkinchi marta ishlasa hech narsa qilmaydi: orgId allaqachon bo'sh.

UPDATE "Terminal"
SET "orgId" = NULL,
    "claimedAt" = NULL,
    "claimStatus" = 'NONE'::"ClaimStatus",
    "claimOrgId" = NULL,
    "claimEvidence" = NULL
WHERE "slug" = 'sergeli-shahobcha-61'
  AND "orgId" = (SELECT "id" FROM "Organization" WHERE "slug" = 'yuksaroy-mchj');
