-- Admin bosh sahifasidagi 30 kunlik voronka amal bo'yicha guruhlaydi. Mavjud
-- indekslarda actorId birinchi ustun, ya'ni bu so'rov butun jadvalni ko'rib chiqardi
-- va bosh sahifa har ochilganda takrorlanardi.
--
-- CONCURRENTLY emas: Prisma migratsiyani tranzaksiyada bajaradi va jadval hozircha
-- kichik. AuditLog millionga yetganda indeks qo'lda CONCURRENTLY bilan qo'yiladi.
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
