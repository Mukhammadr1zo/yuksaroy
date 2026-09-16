-- Ko'chirish migratsiyasi har bir shahobchaga vaqtinchalik "shahobcha-<id>" slug qo'ygan edi,
-- chiroylisini alohida skript qo'yishi kerak edi. Prodda o'sha skript ishlamagan va bitta qator
-- id li manzil bilan qolib ketgan: /terminals/shahobcha-cmtwhn32300j5p4a37rgfwfjz.
-- Manzil foydalanuvchiga ko'rinadi va ulashiladi, shuning uchun o'qiladigan bo'lishi kerak.
--
-- Nega skript emas, migratsiya: skriptni serverda qo'lda ishga tushirish kerak, migratsiya esa
-- API konteyneri ko'tarilganda o'zi qo'llanadi. Qayta ishga tushsa ham xavfsiz: faqat
-- vaqtinchalik naqshdagi qatorlarga tegadi va band manzilni egallamaydi.
--
-- Stansiya nomi allaqachon lotin (Station.nameUz), shuning uchun kirilldan o'girish kerak emas.
-- Apostrof tashlanadi (Qo'qon -> qoqon), qolgan harf va raqam bo'lmagan belgilar chiziqchaga.
UPDATE "Terminal" t
SET slug = n.new_slug
FROM (
  SELECT
    t2.id,
    trim(
      both '-' from
      regexp_replace(
        translate(
          lower(coalesce(s."nameUz", '') || '-shahobcha-' || coalesce(t2."registryNo"::text, '')),
          chr(39) || chr(96) || chr(699) || chr(8217),
          ''
        ),
        '[^a-z0-9]+', '-', 'g'
      )
    ) AS new_slug
  FROM "Terminal" t2
  LEFT JOIN "Station" s ON s.id = t2."stationId"
  WHERE t2.kind = 'RAIL'
    AND t2.slug ~ ('^shahobcha-c[a-z0-9]{20,}$')
) n
WHERE t.id = n.id
  -- Stansiyasi ham, reestr raqami ham bo'lmasa "shahobcha" dan boshqa narsa chiqmaydi:
  -- bunday qator vaqtinchalik id bilan qolgani ma'qul, chunki u hech bo'lmasa noyob.
  AND n.new_slug <> ''
  AND n.new_slug <> 'shahobcha'
  -- Slug UNIQUE: band bo'lsa tegmaymiz, aks holda migratsiya yiqilib deployni to'xtatardi
  AND NOT EXISTS (SELECT 1 FROM "Terminal" x WHERE x.slug = n.new_slug AND x.id <> t.id);
