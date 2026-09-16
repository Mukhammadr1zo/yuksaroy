-- Reestrdan kelgan tipografik belgilarni ASCII ga o'tkazish.
-- Nega: bu nomlar terminal kartochkasida foydalanuvchiga ko'rinadi, egri qo'shtirnoq
-- va en tire o'zbek lotinida noto'g'ri ko'rinadi hamda nusxa-ko'chirishda buziladi.
-- Nega backtick: shu reestrning o'zida backtick allaqachon ustun (667 qator), ya'ni
-- yangi uslub kiritilmayapti, mavjudiga moslanyapti.
-- seed/build-data.ts endi shu ko'rinishda yozadi, bu migratsiya mavjud bazani tenglashtiradi.
--
-- chr() ishlatilgan (U&'...' emas): migratsiya faylida teskari chiziqsiz, o'qilishi oson.
--   8220/8221 egri qo'shtirnoq, 8216/8217 egri apostrof, 8211/8212 en va em tire.
UPDATE "Terminal" SET
  "name" = translate(
    "name",
    chr(8220) || chr(8221) || chr(8216) || chr(8217) || chr(8211) || chr(8212),
    '``''''--'
  ),
  "ownerNameRaw" = translate(
    "ownerNameRaw",
    chr(8220) || chr(8221) || chr(8216) || chr(8217) || chr(8211) || chr(8212),
    '``''''--'
  );
