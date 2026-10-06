-- Bazadagi telefon raqamlarini bitta shaklga keltirish (+998901234567).
-- Egasi 2026-10-06 da tasdiqladi.
--
-- Nega: "90 123 45 67" va "+998901234567" bitta raqam, lekin ikki xil yozilsa ularni
-- solishtirib bo'lmaydi: bitta raqam ortida nechta hisob borligini sanab bo'lmaydi.
-- Yangi yozuvlar 30636f7 dan beri saqlashdan oldin shu shaklga keladi (domain storePhone),
-- bu esa eskilari uchun bir martalik tuzatish.
--
-- Ikki qoida:
-- 1. Tanilmagan qiymatga TEGILMAYDI. Reestrda ikki raqamli ("71 299-12-34, 71 299-12-35")
--    yoki eski shakldagi yozuvlar bor: ularni o'chirsak yoki bo'shatsak ma'lumot yo'qoladi.
-- 2. Faqat shakli o'zgaradigan qator yoziladi. Raqamning o'zi o'zgarmaydi.
--
-- Funksiya domain normalizePhone ning aynan nusxasi va ish tugagach o'chiriladi.
-- updatedAt ga tegilmaydi (uni Prisma yuritadi): e'lon "yaqinda yangilangan" bo'lib
-- ko'rinmasin.

CREATE OR REPLACE FUNCTION ys_store_phone(raw text) RETURNS text AS $$
DECLARE
  d text := regexp_replace(raw, '[^0-9]', '', 'g');
BEGIN
  IF d = '' THEN RETURN NULL; END IF;
  IF raw ~ '^\s*\+' THEN
    -- O'zbekiston raqami uzunligi qat'iy: +998 va to'qqiz xonali milliy qism
    IF left(d, 3) = '998' THEN
      RETURN CASE WHEN length(d) = 12 THEN '+' || d END;
    END IF;
    -- E.164: davlat kodi noldan boshlanmaydi, umumiy uzunlik 8 dan 15 gacha
    IF left(d, 1) = '0' OR length(d) < 8 OR length(d) > 15 THEN RETURN NULL; END IF;
    RETURN '+' || d;
  END IF;
  -- "+" siz yozilgan qiymat O'zbekiston raqami deb o'qiladi
  IF length(d) = 9 THEN RETURN '+998' || d; END IF;
  IF length(d) = 12 AND left(d, 3) = '998' THEN RETURN '+' || d; END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql IMMUTABLE;

UPDATE "Listing" SET "contactPhone" = ys_store_phone("contactPhone")
  WHERE ys_store_phone("contactPhone") IS NOT NULL AND ys_store_phone("contactPhone") <> "contactPhone";
UPDATE "Terminal" SET "phone" = ys_store_phone("phone")
  WHERE ys_store_phone("phone") IS NOT NULL AND ys_store_phone("phone") <> "phone";
UPDATE "Terminal" SET "contactPhone" = ys_store_phone("contactPhone")
  WHERE ys_store_phone("contactPhone") IS NOT NULL AND ys_store_phone("contactPhone") <> "contactPhone";
UPDATE "Organization" SET "phone" = ys_store_phone("phone")
  WHERE ys_store_phone("phone") IS NOT NULL AND ys_store_phone("phone") <> "phone";
-- Bu uchtasi yozishda allaqachon tekshiriladi; eski qatorlar bo'lsa ular ham bir shaklda bo'lsin
UPDATE "MarketRequest" SET "contactPhone" = ys_store_phone("contactPhone")
  WHERE ys_store_phone("contactPhone") IS NOT NULL AND ys_store_phone("contactPhone") <> "contactPhone";
UPDATE "ServiceProfile" SET "contactPhone" = ys_store_phone("contactPhone")
  WHERE ys_store_phone("contactPhone") IS NOT NULL AND ys_store_phone("contactPhone") <> "contactPhone";
UPDATE "UrgentRequest" SET "contactPhone" = ys_store_phone("contactPhone")
  WHERE ys_store_phone("contactPhone") IS NOT NULL AND ys_store_phone("contactPhone") <> "contactPhone";

DROP FUNCTION ys_store_phone(text);
