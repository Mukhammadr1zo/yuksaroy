-- Tarif obuna narxi va kunlik raqam sonining YAGONA manbai bo'ladi.
--
-- Nega: narx sozlamada, tarif esa alohida edi va ikkisi bir-biriga zid ketardi.
-- Admin tarifni arzonlashtirsa devor baribir sozlamadagi narxni ko'rsatardi.
-- Sxema o'zgarmaydi, faqat ma'lumot ko'chadi.
--
-- Faol tarif bo'lmasa sozlamadagi narx va kunlik sondan bitta tarif yasaladi:
-- bugungi obunachi va narxlar sahifasi hech narsa sezmaydi. Shart faol qatorlarga
-- qaraydi, borligiga emas: admin sinov tarifini yaratib sotuvdan olgan bo'lsa ham
-- sotuvda tarif qolsin, aks holda sozlamadagi narx izsiz yo'qolib buyurtma to'xtardi.
--
-- Ikki marta ishlasa ham buzilmaydi: NOT EXISTS ikkinchi safar bo'sh o'tadi, DELETE
-- esa o'chirilgan qatorni qayta topmaydi. ON CONFLICT: id yoki kod sotuvdan olingan
-- qatorda band bo'lsa migratsiya yiqilmasin (migrate deploy yiqilsa sayt yotadi).
INSERT INTO "Plan" ("id", "code", "name", "features", "priceMonthSom", "grants", "limits", "maxMonths", "sort", "active", "createdAt", "updatedAt")
SELECT
  'plan_obuna',
  'obuna',
  jsonb_build_object('uz', 'Obuna', 'ru', 'Подписка', 'en', 'Subscription'),
  jsonb_build_object(
    'uz', jsonb_build_array('Telefon raqamlari ochiladi', 'Vagon qidiruvi cheksiz', 'E''lonlar ro''yxatda yuqorida', '30 kunlik ko''rsatkichlar'),
    'ru', jsonb_build_array('Телефонные номера открыты', 'Поиск вагонов без ограничений', 'Объявления выше в списке', 'Показатели за 30 дней'),
    'en', jsonb_build_array('Phone numbers unlocked', 'Unlimited wagon search', 'Listings ranked higher', '30-day performance stats')
  ),
  -- Sozlama qiymati JSONB da son bo'lib turadi: #>> '{}' uni matnga, ::int songa o'giradi
  COALESCE((SELECT ("value" #>> '{}')::int FROM "PlatformConfig" WHERE "key" = 'subscriptionMonthSom'), 99000),
  ARRAY['PHONE', 'WAGON']::text[],
  jsonb_build_object('phoneRevealDaily', COALESCE((SELECT ("value" #>> '{}')::int FROM "PlatformConfig" WHERE "key" = 'phoneRevealDaily'), 50)),
  12,
  0,
  true,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM "Plan" WHERE "active")
ON CONFLICT DO NOTHING;

-- Eski forma kunlik sonni bo'sh qoldirgan ("sozlamadagidek"): sozlamadagi son tarifga
-- ko'chadi, yo'qolmaydi. Aks holda admin qo'ygan son jimgina zaxira 50 ga aylanardi va
-- tarifni keyingi tahrirda kunlik son majburiy degan qoida to'xtatardi.
UPDATE "Plan"
SET "limits" = COALESCE("limits", '{}'::jsonb) || jsonb_build_object('phoneRevealDaily',
      COALESCE((SELECT ("value" #>> '{}')::int FROM "PlatformConfig" WHERE "key" = 'phoneRevealDaily'), 50)),
    "updatedAt" = now()
WHERE 'PHONE' = ANY("grants")
  AND ("limits" IS NULL OR NOT ("limits" ? 'phoneRevealDaily'));

-- Vagon ilgari tarifsiz ham sozlamadagi narxda sotilardi: shu narxda yoki arzonroq WAGON
-- beradigan faol tarif bo'lmasa alohida vagon tarifi yasaladi. Aks holda vagon narxi jim
-- ko'tarilardi yoki (faqat telefon tarifi bo'lsa) vagon umuman sotilmay qolardi.
-- Narxlar teng va jadval bo'sh bo'lsa yuqoridagi "obuna" allaqachon shu narxda WAGON
-- beradi, shart bo'sh o'tadi: bugungi bitta karta saqlanadi.
INSERT INTO "Plan" ("id", "code", "name", "features", "priceMonthSom", "grants", "limits", "maxMonths", "sort", "active", "createdAt", "updatedAt")
SELECT
  'plan_vagon',
  'vagon',
  jsonb_build_object('uz', 'Vagon qidiruvi', 'ru', 'Поиск вагонов', 'en', 'Wagon search'),
  jsonb_build_object('uz', jsonb_build_array('Vagon qidiruvi cheksiz'), 'ru', jsonb_build_array('Поиск вагонов без ограничений'), 'en', jsonb_build_array('Unlimited wagon search')),
  w.price,
  ARRAY['WAGON']::text[],
  NULL,
  12,
  1,
  true,
  now(),
  now()
FROM (SELECT COALESCE((SELECT ("value" #>> '{}')::int FROM "PlatformConfig" WHERE "key" = 'wagonMonthSom'), 99000) AS price) w
WHERE NOT EXISTS (SELECT 1 FROM "Plan" WHERE "active" AND 'WAGON' = ANY("grants") AND "priceMonthSom" <= w.price)
ON CONFLICT DO NOTHING;

-- Uch kalit endi kodda ham yo'q: qolsa admin sozlama ekranida noma'lum qator bo'lib turardi
DELETE FROM "PlatformConfig" WHERE "key" IN ('subscriptionMonthSom', 'wagonMonthSom', 'phoneRevealDaily');
