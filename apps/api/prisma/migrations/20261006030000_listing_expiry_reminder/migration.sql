-- E'lon muddati tugashidan uch kun oldin egasiga bitta eslatma: yuborilgani shu maydon bilan
-- belgilanadi, e'lon qayta faol bo'lganda (yangi muddat) belgi tozalanadi.
-- Ixtiyoriy ustun, mavjud qatorlarga tegilmaydi: birinchi siklda oynaga tushganlari eslatiladi.
-- Indeks qo'shilmadi: tanlov holat va muddat bo'yicha, Listing_status_expiresAt_idx yetadi.
ALTER TABLE "Listing" ADD COLUMN "expiryRemindedAt" TIMESTAMPTZ(3);
