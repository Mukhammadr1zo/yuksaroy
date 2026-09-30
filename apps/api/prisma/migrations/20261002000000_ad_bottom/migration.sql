-- Pastki banner: chiqish kechikishi, turish muddati va jim vaqt bazada turadi, kodda emas.
-- Sabab: bu uchtasi sotuv shartnomasining bir qismi ("8 soniyada chiqsin" deb kelishiladi),
-- ya'ni ular o'zgarganda deploy kutilmasligi kerak.
--
-- Sukut qiymatlar egasi tasdiqlagan o'lchov: 8 soniyada chiqadi, 15 soniya turadi,
-- yopilgach 12 soat qayta ko'rinmaydi (kuniga ko'pi bilan ikki marta). Shuning uchun
-- ADD COLUMN ... DEFAULT: mavjud qatorlar ham to'g'ri son bilan to'ladi va kodda
-- "eski qatormi" degan shart kerak bo'lmaydi. Yon ustunlar bu sonlarni o'qimaydi,
-- ya'ni ishlab turgan reklamaga zarari yo'q.
--
-- locale uchun sukut yo'q: NULL = hamma tilda chiqadi. Bo'sh satr ('') emas, chunki
-- unda "hamma til" va "tili yo'q" bir xil ko'rinardi.
ALTER TABLE "AdPlacement" ADD COLUMN "delaySec" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "showSec" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "quietHours" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN "locale" TEXT;
