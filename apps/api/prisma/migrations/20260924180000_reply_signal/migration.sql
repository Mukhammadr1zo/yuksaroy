-- O'lchangan javob signali: e'lon sahifasida egasi o'zi yozgan javob muddati
-- o'rniga egasining oxirgi faolligi va javob bergan yozishmalari nisbati chiqadi.
--
-- Javob muddatini egasining o'zi yozardi va yonida "o'lchanmagan" deb turardi.
-- Endi ekranda o'lchangan signal bor, ya'ni bu ustunni hech kim o'qimaydi.
-- Yangi ma'lumot ham yozilmaydi: forma maydoni va tekshiruvi ham olib tashlandi.
--
-- Signal sessiya va yozishma jadvallaridan o'qiladi, ikkalasida ham kerakli indeks
-- allaqachon bor: yangi indeks qo'shilmaydi.
ALTER TABLE "Listing" DROP COLUMN "responseHours";
