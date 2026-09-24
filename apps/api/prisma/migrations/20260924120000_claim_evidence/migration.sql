-- Da'vo yuborishda majburiy izoh va ixtiyoriy hujjat, tashkilot tasdig'ida esa hujjat.
-- Nega yangi ustun, mavjudi emas: Terminal.note va Terminal.passport ochiq sahifada
-- chiqadi, Organization.storefront ochiq do'kon ma'lumoti, kycNote esa moderator izohi.
-- Audit jurnaliga yozish ham yaramaydi: AuditService.log xatoni yutadi, ya'ni da'vo
-- saqlanib, qaror uchun kerak bo'lgan izoh jimgina yo'qolishi mumkin edi.

-- Eski da'volarda dalil yo'q, shuning uchun NULL ruxsat etiladi va backfill qilinmaydi.
ALTER TABLE "Terminal" ADD COLUMN "claimEvidence" JSONB;

-- Navbatda turgan eski so'rovlarda bo'sh qoladi: yangi shart faqat yangi so'rovlarga tegadi.
ALTER TABLE "Organization" ADD COLUMN "kycDocs" JSONB;

-- Indeks yo'q: bu ustunlar bo'yicha na filtr, na saralash bo'ladi. DEFAULT yo'q,
-- ya'ni ALTER jadvalni qayta yozmaydi va qulflamaydi.
