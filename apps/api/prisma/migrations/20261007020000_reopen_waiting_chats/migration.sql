-- Javob kutayotgan eski suhbatlarni bir marta qayta ochish.
-- Egasi 2026-10-07 da tasdiqladi.
--
-- Nega: ce36e0b gacha mijozning javobdan keyingi xabari holatga tegmasdi, suhbat ANSWERED
-- bo'lib qolardi. Shuning uchun oxirgi xabari mijozniki bo'lgan, ya'ni mijoz haqiqatan javob
-- kutayotgan suhbat kabinetda "Javob kutilmoqda" bo'lmasdi, platformaniki esa admin navbatiga
-- tushmasdi. Yangi xabarlar ce36e0b dan beri to'g'ri belgilanadi (chat/inquiry-status.ts),
-- bu esa eskilari uchun bir martalik tuzatish.
--
-- Egasi bilib turib qabul qildi: ular orasidagi platforma suhbatlari darhol admin navbatiga
-- va ikki kunlik eslatmaga tushadi. "Rahmat" bilan tugaganini qabul qiluvchi tomon
-- "Javob shart emas" tugmasi bilan yopadi.
--
-- Qoidalar:
-- 1. Faqat ANSWERED qator va faqat status yoziladi. lastMessageAt ga tegilmaydi: ro'yxat
--    tartibi o'zgarmasin. Inquiry da updatedAt ustuni yo'q.
-- 2. Oxirgi xabar createdAt bo'yicha, vaqti teng bo'lsa id bo'yicha. Mijoz = Inquiry.fromUserId:
--    undan boshqa yozuvchi faqat qabul qiluvchi tomon (threadRole).
-- 3. Xabarsiz suhbatda ichki so'rov NULL beradi va "=" rost bo'lmaydi: qator o'zgarmaydi.
UPDATE "Inquiry" i
SET "status" = 'OPEN'
WHERE i."status" = 'ANSWERED'
  AND i."fromUserId" = (
    SELECT m."fromUserId" FROM "InquiryMessage" m
    WHERE m."inquiryId" = i."id"
    ORDER BY m."createdAt" DESC, m."id" DESC
    LIMIT 1
  );
