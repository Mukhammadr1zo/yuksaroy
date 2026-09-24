-- "Ish bajarildi" yangi holat: AWARDED -> DONE. MarketRequest.status oddiy matn ustun
-- (CHECK ham, enum ham yo'q), shuning uchun ustunga tegilmaydi.
--
-- Nega eski qatorlar ko'chiriladi: shu paytgacha tanlangan so'rovda kabinetdagi yagona
-- yo'l "Ijrochi tanlandi. Ish tugagach so'rovni yoping" edi, ya'ni AWARDED dan CLOSED ga
-- o'tish aynan bajarilgan ishni bildirardi. Ko'chirilmasa, shu vaqtgacha ishlab bergan
-- odamlarning hammasida sanoq noldan boshlanardi va yangi belgi bo'sh ko'rinardi.
--
-- Tanlovsiz yopilgan so'rovlar (awardedOfferId NULL) tegilmaydi: ularda ijrochi ham,
-- ish ham bo'lmagan. Namuna qatorlar ham tegilmaydi: ularning hammasi OPEN va
-- awardedOfferId NULL.
UPDATE "MarketRequest"
SET "status" = 'DONE'
WHERE "status" = 'CLOSED' AND "awardedOfferId" IS NOT NULL;
