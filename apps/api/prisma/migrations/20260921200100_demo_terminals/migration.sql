-- Namuna ma'lumotlar (isDemo = true): sayt bo'sh ko'rinmasligi uchun.
-- Har qatorda "Namuna" belgisi chiqadi, telefon yo'q, chat va taklif yopiq.
-- Admin panelidagi "Namuna ma'lumotlarni o'chirish" tugmasi bilan olib tashlanadi;
-- migratsiya bir marta ishlagani uchun ular qaytib kelmaydi.
-- Fayl qo'lda yozilmagan: prisma/seed/demo-sql.ts shu ma'lumotdan yasaydi.

INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-01', 'namuna-nur-trans-logistika-mchj', 'CARRIER'::"OrgKind", ARRAY['CARRIER']::"OrgKind"[], 'Nur Trans Logistika MChJ', 'Toshkentdan viloyatlarga tentli va refrijerator mashinalarda yuk tashiymiz. O''z parkimiz 18 ta mashina, haydovchilar shtatda.', 'UZ-TK', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-02', 'namuna-samarqand-yuk-tashish-mchj', 'CARRIER'::"OrgKind", ARRAY['CARRIER']::"OrgKind"[], 'Samarqand Yuk Tashish MChJ', 'Samarqand va Jizzax bo''ylab qurilish materiallari, don va meva tashish. Ag''daruvchi va tentli mashinalar.', 'UZ-SA', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-03', 'namuna-vodiy-avto-karvon-mchj', 'CARRIER'::"OrgKind", ARRAY['CARRIER']::"OrgKind"[], 'Vodiy Avto Karvon MChJ', 'Farg''ona vodiysi ichida va Toshkentga muntazam reyslar. Konteyner tashuvchi platformalar ham bor.', 'UZ-FA', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-04', 'namuna-buxoro-trans-servis-mchj', 'CARRIER'::"OrgKind", ARRAY['CARRIER']::"OrgKind"[], 'Buxoro Trans Servis MChJ', 'Buxoro, Navoiy, Xorazm yo''nalishida sisterna va tentli mashinalar. Suyuq yuk uchun ruxsatnomalar mavjud.', 'UZ-BU', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-05', 'namuna-temir-yol-texnika-ijarasi-mchj', 'ASSET_OWNER'::"OrgKind", ARRAY['ASSET_OWNER']::"OrgKind"[], 'Temir Yo''l Texnika Ijarasi MChJ', 'Yopiq vagon, yarim vagon va platformalarni oylik ijaraga beramiz. Texnik ko''rikdan o''tgan, hujjatlari tartibda.', 'UZ-TK', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-06', 'namuna-navoiy-vagon-servis-mchj', 'ASSET_OWNER'::"OrgKind", ARRAY['ASSET_OWNER']::"OrgKind"[], 'Navoiy Vagon Servis MChJ', 'Xopper va yarim vagonlar, manevr teplovozlari. Navoiy tugunida o''z depomiz bor.', 'UZ-NW', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-07', 'namuna-qarshi-vagon-park-mchj', 'ASSET_OWNER'::"OrgKind", ARRAY['ASSET_OWNER']::"OrgKind"[], 'Qarshi Vagon Park MChJ', 'Sisterna va yopiq vagonlar sotuv va ijaraga. Qashqadaryo va Surxondaryo stansiyalarida turibdi.', 'UZ-QA', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-08', 'namuna-sharq-ekspeditsiya-mchj', 'FORWARDER'::"OrgKind", ARRAY['FORWARDER']::"OrgKind"[], 'Sharq Ekspeditsiya MChJ', 'Temir yo''l va avto yuklarini boshidan oxirigacha kuzatamiz: vagon buyurtma, hujjat, kuzatuv.', 'UZ-TK', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-09', 'namuna-xorazm-yuk-ekspeditor-mchj', 'FORWARDER'::"OrgKind", ARRAY['FORWARDER']::"OrgKind"[], 'Xorazm Yuk Ekspeditor MChJ', 'Urganch va Xiva atrofidan eksport yuklarini jo''natish. Qozog''iston va Rossiya yo''nalishida tajriba.', 'UZ-XO', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-10', 'namuna-bojxona-hujjat-markazi-mchj', 'DECLARANT'::"OrgKind", ARRAY['DECLARANT']::"OrgKind"[], 'Bojxona Hujjat Markazi MChJ', 'Eksport-import deklaratsiyalari, sertifikat va kelib chiqish hujjatlari. Chirchiq va Angren postlari bilan ishlaymiz.', 'UZ-TO', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-11', 'namuna-andijon-deklarant-servis-mchj', 'DECLARANT'::"OrgKind", ARRAY['DECLARANT']::"OrgKind"[], 'Andijon Deklarant Servis MChJ', 'Vodiy korxonalari uchun bojxona rasmiylashtiruvi. Bir kunda tayyorlaymiz, kechikish bo''lsa xabar beramiz.', 'UZ-AN', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-12', 'namuna-jizzax-don-mahsulotlari-mchj', 'SHIPPER'::"OrgKind", ARRAY['SHIPPER']::"OrgKind"[], 'Jizzax Don Mahsulotlari MChJ', 'Bug''doy, un va kepak ishlab chiqaramiz. Har oy 40-60 vagon yuk jo''natamiz, doimiy tashuvchi qidiramiz.', 'UZ-JI', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-21', 'namuna-sergeli-konteyner-maydoni-mchj', 'TERMINAL'::"OrgKind", ARRAY['TERMINAL']::"OrgKind"[], 'Sergeli Konteyner Maydoni MChJ', 'Konteyner qabul qilish, saqlash va avtoga ortish. Kran va yuk tarozisi o''zimizniki.', 'UZ-TK', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-22', 'namuna-navoiy-yuk-maydoni-mchj', 'TERMINAL'::"OrgKind", ARRAY['TERMINAL']::"OrgKind"[], 'Navoiy Yuk Maydoni MChJ', 'Ko''mir, shag''al va mineral o''g''it uchun ochiq maydon. Vagondan avtoga va aksincha.', 'UZ-NW', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-org-23', 'namuna-chuqursoy-ombor-terminali-mchj', 'TERMINAL'::"OrgKind", ARRAY['TERMINAL']::"OrgKind"[], 'Chuqursoy Ombor Terminali MChJ', 'Yopiq ombor va yuk maydoni. Saqlash, qayta ortish va shahar ichiga yetkazib berish.', 'UZ-TK', 'NONE'::"KycStatus", NULL, true, now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-01', '+998900000101', 'Akmal Yusupov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-01-m', 'demo-user-01', 'demo-org-01', ARRAY['CARRIER', 'DRIVER']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-02', '+998900000102', 'Dilshod Rahimov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-02-m', 'demo-user-02', 'demo-org-02', ARRAY['CARRIER', 'DRIVER']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-03', '+998900000103', 'Bekzod Karimov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-03-m', 'demo-user-03', 'demo-org-03', ARRAY['CARRIER', 'DRIVER']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-04', '+998900000104', 'Sardor Tursunov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-04-m', 'demo-user-04', 'demo-org-04', ARRAY['CARRIER', 'DRIVER']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-05', '+998900000105', 'Jasur Abdullayev', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-05-m', 'demo-user-05', 'demo-org-05', ARRAY['ASSET_OWNER']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-06', '+998900000106', 'Otabek Mirzayev', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-06-m', 'demo-user-06', 'demo-org-06', ARRAY['ASSET_OWNER']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-07', '+998900000107', 'Nodir Qodirov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-07-m', 'demo-user-07', 'demo-org-07', ARRAY['ASSET_OWNER']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-08', '+998900000108', 'Shahnoza Ergasheva', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-08-m', 'demo-user-08', 'demo-org-08', ARRAY['FORWARDER', 'CLIENT']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-09', '+998900000109', 'Farrux Saidov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-09-m', 'demo-user-09', 'demo-org-09', ARRAY['FORWARDER', 'CLIENT']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-10', '+998900000110', 'Madina Nazarova', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-10-m', 'demo-user-10', 'demo-org-10', ARRAY['DECLARANT']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-11', '+998900000111', 'Ulug''bek Toshpulatov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-11-m', 'demo-user-11', 'demo-org-11', ARRAY['DECLARANT']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-12', '+998900000112', 'Sherzod Ismoilov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-12-m', 'demo-user-12', 'demo-org-12', ARRAY['CLIENT']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-13', '+998900000113', 'Aziz Xolmatov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-14', '+998900000114', 'Kamola Yuldasheva', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-15', '+998900000115', 'Bobur Sattorov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-16', '+998900000116', 'Nilufar Hakimova', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-17', '+998900000117', 'Rustam Jalilov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-18', '+998900000118', 'Gulnora Olimova', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-19', '+998900000119', 'Doston Nurmatov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-20', '+998900000120', 'Zafar Boboyev', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-21', '+998900000121', 'Muhammad Ali Umarov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-22', '+998900000122', 'Sevara Qosimova', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-23', '+998900000123', 'Javohir Ortiqov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-24', '+998900000124', 'Feruza Mamatova', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-25', '+998900000125', 'Alisher Ganiyev', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-26', '+998900000126', 'Iroda Sobirova', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-27', '+998900000127', 'Elyor Xasanov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-28', '+998900000128', 'Dilnoza Ahmedova', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-29', '+998900000129', 'Sanjar Rasulov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-30', '+998900000130', 'Mavluda Tojiyeva', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-31', '+998900000131', 'Behzod Qurbonov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-32', '+998900000132', 'Laylo Sharipova', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-33', '+998900000133', 'Temur Egamberdiyev', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-34', '+998900000134', 'Nargiza Abdurahmonova', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-35', '+998900000135', 'Sirojiddin Haydarov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-36', '+998900000136', 'Yulduz Norboyeva', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-37', '+998900000137', 'Ravshan Mahmudov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-38', '+998900000138', 'Zilola Usmonova', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-39', '+998900000139', 'Qahramon Berdiyev', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-40', '+998900000140', 'Oydin Rustamova', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-41', '+998900000141', 'Ulug''bek Rahmonov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-41-m', 'demo-user-41', 'demo-org-21', ARRAY['TERMINAL_OPERATOR', 'TERMINAL_ADMIN']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-42', '+998900000142', 'Sanjar Eshonov', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-42-m', 'demo-user-42', 'demo-org-22', ARRAY['TERMINAL_OPERATOR', 'TERMINAL_ADMIN']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;
INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")
VALUES ('demo-user-43', '+998900000143', 'Dilshod Aliyev', 'uz', false, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")
VALUES ('demo-user-43-m', 'demo-user-43', 'demo-org-23', ARRAY['TERMINAL_OPERATOR', 'TERMINAL_ADMIN']::"Role"[], true, now())
ON CONFLICT ("userId", "orgId") DO NOTHING;

INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-01', 'namuna-yopiq-vagon-ijara-10', 'demo-org-05', 'demo-user-05', 'WAGON'::"ListingKind", 'RENT'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Yopiq vagonlar ijaraga, 10 dona', 'Don, un va qadoqlangan yuk uchun yopiq vagonlar. Texnik ko''rik shu yil o''tgan, kamida 3 oyga beriladi.', 'UZ-TK', 41.311, 69.28, 950000000::BIGINT,
  'PER_MONTH'::"PriceUnit", ARRAY['/demo/wagon-covered-1.jpg', '/demo/wagon-covered-2.jpg']::TEXT[], 2012, 'GOOD'::"Condition",
  '11-280', 10, 'COVERED', 68, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, NULL, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-02', 'namuna-yarim-vagon-ijara-20', 'demo-org-06', 'demo-user-06', 'WAGON'::"ListingKind", 'RENT'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Yarim vagonlar ijaraga, 20 dona', 'Ko''mir, shag''al va metall uchun yarim vagonlar. Navoiy stansiyasida turibdi, bir kunda topshiramiz.', 'UZ-NW', 40.084, 65.379, 880000000::BIGINT,
  'PER_MONTH'::"PriceUnit", ARRAY['/demo/wagon-gondola-2.jpg', '/demo/wagon-gondola-3.jpg']::TEXT[], 2015, 'GOOD'::"Condition",
  '12-132', 20, 'GONDOLA', 70, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, NULL, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-03', 'namuna-platforma-konteyner-8', 'demo-org-05', 'demo-user-05', 'WAGON'::"ListingKind", 'RENT'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Platformalar konteyner uchun, 8 dona', '20 va 40 futlik konteyner qulflari bor. Chuqursoy va Sergeli yo''nalishida ishlagan.', 'UZ-TK', 41.311, 69.28, 720000000::BIGINT,
  'PER_MONTH'::"PriceUnit", ARRAY['/demo/wagon-platform-3.jpg', '/demo/wagon-platform-1.jpg']::TEXT[], 2010, 'GOOD'::"Condition",
  '13-4012', 8, 'PLATFORM', 60, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, NULL, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-04', 'namuna-sisterna-sotuv-4', 'demo-org-07', 'demo-user-07', 'WAGON'::"ListingKind", 'SALE'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Sisternalar sotuvga, 4 dona', 'Neft mahsulotlari uchun sisternalar. Ta''mir talab: qozon tekshiruvi kerak, narx shunga qarab qo''yilgan.', 'UZ-QA', 38.861, 65.789, 42000000000::BIGINT,
  'TOTAL'::"PriceUnit", ARRAY['/demo/wagon-tank-1.jpg', '/demo/wagon-tank-2.jpg']::TEXT[], 2008, 'NEEDS_REPAIR'::"Condition",
  '15-1443', 4, 'TANK', 60, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, NULL, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-05', 'namuna-xopper-sement-ijara', 'demo-org-06', 'demo-user-06', 'WAGON'::"ListingKind", 'RENT'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Xopper vagonlar sement uchun', 'Sement va mineral o''g''it uchun yopiq xopperlar. Pnevmatik tushirish, yuklash lyuklari ishlaydi.', 'UZ-NW', 40.084, 65.379, 1020000000::BIGINT,
  'PER_MONTH'::"PriceUnit", ARRAY['/demo/wagon-hopper-1.jpg', '/demo/wagon-hopper-2.jpg']::TEXT[], 2017, 'GOOD'::"Condition",
  '19-3116', 12, 'HOPPER', 70, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, NULL, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-06', 'namuna-yopiq-vagon-sotuv-1', 'demo-org-07', 'demo-user-07', 'WAGON'::"ListingKind", 'SALE'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Yopiq vagon sotuvga, 1 dona', 'Bitta yopiq vagon, ombor sifatida ham ishlatsa bo''ladi. Hujjatlari to''liq, egasi tashkilot.', 'UZ-QA', 38.861, 65.789, 18000000000::BIGINT,
  'TOTAL'::"PriceUnit", ARRAY['/demo/wagon-covered-2.jpg', '/demo/wagon-covered-1.jpg']::TEXT[], 2005, 'GOOD'::"Condition",
  '11-217', 1, 'COVERED', 66, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, NULL, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-07', 'namuna-refrijerator-meva-ijara', 'demo-org-05', 'demo-user-05', 'WAGON'::"ListingKind", 'RENT'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Refrijerator vagonlar meva uchun', 'Meva-sabzavot eksporti uchun sovutgichli vagonlar. Harorat -5 dan +14 gacha. Mavsumda oldindan band qiling.', 'UZ-TK', 41.311, 69.28, 1450000000::BIGINT,
  'PER_MONTH'::"PriceUnit", ARRAY['/demo/wagon-covered-2.jpg', '/demo/wagon-covered-1.jpg']::TEXT[], 2014, 'GOOD'::"Condition",
  'ARV-E', 6, 'REFRIGERATOR', 50, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, NULL, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-08', 'namuna-yarim-vagon-sotuv-5', 'demo-org-06', 'demo-user-06', 'WAGON'::"ListingKind", 'SALE'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Yarim vagonlar sotuvga, 5 dona', 'Ishlayotgan yarim vagonlar, oxirgi ta''mir 2024. Narx bitta vagon uchun emas, 5 tasi uchun jami.', 'UZ-NW', 40.084, 65.379, 21000000000::BIGINT,
  'TOTAL'::"PriceUnit", ARRAY['/demo/wagon-gondola-2.jpg', '/demo/wagon-gondola-3.jpg']::TEXT[], 2009, 'GOOD'::"Condition",
  '12-119', 5, 'GONDOLA', 69, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, NULL, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-09', 'namuna-platforma-uzun-yuk-ijara', 'demo-org-07', 'demo-user-07', 'WAGON'::"ListingKind", 'RENT'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Platformalar uzun yuk uchun', 'Quvur, armatura va texnika tashish uchun platformalar. Mahkamlash uchun ko''zlar bor.', 'UZ-QA', 38.861, 65.789, 690000000::BIGINT,
  'PER_MONTH'::"PriceUnit", ARRAY['/demo/wagon-platform-3.jpg', '/demo/wagon-platform-1.jpg']::TEXT[], 2013, 'GOOD'::"Condition",
  '13-401', 6, 'PLATFORM', 65, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, NULL, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-10', 'namuna-sisterna-suyuq-ijara', 'demo-org-05', 'demo-user-05', 'WAGON'::"ListingKind", 'RENT'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Sisternalar suyuq yuk ijaraga', 'O''simlik moyi va shakar siropi uchun toza sisternalar. Har reysdan keyin yuviladi, dalolatnoma beriladi.', 'UZ-TK', 41.311, 69.28, 1200000000::BIGINT,
  'PER_MONTH'::"PriceUnit", ARRAY['/demo/wagon-tank-1.jpg', '/demo/wagon-tank-2.jpg']::TEXT[], 2016, 'GOOD'::"Condition",
  '15-1547', 3, 'TANK', 60, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, NULL, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-11', 'namuna-tentli-fura-toshkent-fargona', 'demo-org-01', 'demo-user-01', 'TRUCK'::"ListingKind", NULL, 'ACTIVE'::"ListingStatus",
  'Tentli fura 20 t, Toshkent-Farg''ona', 'Vodiyga har kuni jo''naymiz, yo''lda 8-9 soat. Yuk sug''urtasi bor, haydovchilar tajribali.', 'UZ-TK', 41.311, 69.28, 320000000::BIGINT,
  'PER_TRIP'::"PriceUnit", ARRAY['/demo/truck-tent-1.jpg', '/demo/truck-tent-2.jpg']::TEXT[], NULL, NULL,
  NULL, 1, NULL, NULL, 'TENT', 20, 6,
  ARRAY['UZ-TK', 'UZ-TO', 'UZ-FA', 'UZ-AN', 'UZ-NG']::TEXT[], '[{"from":"UZ-TK","to":"UZ-FA"},{"from":"UZ-TK","to":"UZ-AN"}]'::jsonb, NULL, 2, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-12', 'namuna-refrijerator-18t-meva', 'demo-org-01', 'demo-user-01', 'TRUCK'::"ListingKind", NULL, 'ACTIVE'::"ListingStatus",
  'Refrijerator 18 t, meva eksporti', 'Sovutgichli mashinalar, harorat yozuvi bilan. Meva, go''sht va sut mahsulotlari uchun.', 'UZ-TK', 41.311, 69.28, 950000::BIGINT,
  'PER_KM'::"PriceUnit", ARRAY['/demo/truck-reefer-2.jpg', '/demo/truck-reefer-1.jpg']::TEXT[], NULL, NULL,
  NULL, 1, NULL, NULL, 'REF', 18, 4,
  ARRAY['UZ-TK', 'UZ-SA', 'UZ-BU', 'UZ-XO']::TEXT[], '[{"from":"UZ-TK","to":"UZ-XO"}]'::jsonb, NULL, 2, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-13', 'namuna-agdaruvchi-25t-qurilish', 'demo-org-02', 'demo-user-02', 'TRUCK'::"ListingKind", NULL, 'ACTIVE'::"ListingStatus",
  'Ag''daruvchi 25 t, qurilish yuklari', 'Shag''al, qum, tuproq tashiymiz. Karer va qurilish maydonlariga kirish bor.', 'UZ-SA', 39.655, 66.96, 4500000::BIGINT,
  'PER_TON'::"PriceUnit", ARRAY['/demo/truck-dump-1.jpg', '/demo/truck-dump-2.jpg']::TEXT[], NULL, NULL,
  NULL, 1, NULL, NULL, 'TIPPER', 25, 5,
  ARRAY['UZ-SA', 'UZ-JI', 'UZ-SI']::TEXT[], '[{"from":"UZ-SA","to":"UZ-JI"}]'::jsonb, NULL, 2, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-14', 'namuna-tentli-20t-samarqand-toshkent', 'demo-org-02', 'demo-user-02', 'TRUCK'::"ListingKind", NULL, 'ACTIVE'::"ListingStatus",
  'Tentli 20 t, Samarqand-Toshkent', 'Har hafta 3-4 reys, qaytishda ham yuk olamiz. Yuk ortish va tushirishga yordam beramiz.', 'UZ-SA', 39.655, 66.96, 260000000::BIGINT,
  'PER_TRIP'::"PriceUnit", ARRAY['/demo/truck-tent-1.jpg', '/demo/truck-tent-2.jpg']::TEXT[], NULL, NULL,
  NULL, 1, NULL, NULL, 'TENT', 20, 3,
  ARRAY['UZ-SA', 'UZ-TK', 'UZ-TO']::TEXT[], '[{"from":"UZ-SA","to":"UZ-TK"}]'::jsonb, NULL, 2, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-15', 'namuna-konteyner-tashuvchi-40-fut', 'demo-org-03', 'demo-user-03', 'TRUCK'::"ListingKind", NULL, 'ACTIVE'::"ListingStatus",
  'Konteyner tashuvchi, 40 fut', 'Konteyner terminalidan olib, korxonaga yetkazamiz. 20 va 40 futlik konteynerlar.', 'UZ-FA', 40.386, 71.786, 380000000::BIGINT,
  'PER_TRIP'::"PriceUnit", ARRAY['/demo/truck-container-1.jpg', '/demo/truck-container-2.jpg']::TEXT[], NULL, NULL,
  NULL, 1, NULL, NULL, 'CONTAINER', 26, 4,
  ARRAY['UZ-FA', 'UZ-AN', 'UZ-NG', 'UZ-TK']::TEXT[], '[{"from":"UZ-FA","to":"UZ-TK"}]'::jsonb, NULL, 2, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-16', 'namuna-tentli-10t-vodiy', 'demo-org-03', 'demo-user-03', 'TRUCK'::"ListingKind", NULL, 'ACTIVE'::"ListingStatus",
  'Tentli 10 t, vodiy ichida', 'Kichik partiyalar uchun 10 tonnalik mashinalar. Shahar ichi va vodiy bo''ylab bir kunda.', 'UZ-FA', 40.386, 71.786, 600000::BIGINT,
  'PER_KM'::"PriceUnit", ARRAY['/demo/truck-tent-3.jpg', '/demo/truck-tent-1.jpg']::TEXT[], NULL, NULL,
  NULL, 1, NULL, NULL, 'TENT', 10, 8,
  ARRAY['UZ-FA', 'UZ-AN', 'UZ-NG']::TEXT[], '[{"from":"UZ-FA","to":"UZ-AN"},{"from":"UZ-FA","to":"UZ-NG"}]'::jsonb, NULL, 2, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-17', 'namuna-sisterna-22t-suyuq', 'demo-org-04', 'demo-user-04', 'TRUCK'::"ListingKind", NULL, 'ACTIVE'::"ListingStatus",
  'Sisterna 22 t, suyuq yuk', 'Oziq-ovqat va texnik suyuqliklar uchun alohida sisternalar. Ruxsatnoma va yuvish dalolatnomasi beriladi.', 'UZ-BU', 39.775, 64.429, 820000::BIGINT,
  'PER_KM'::"PriceUnit", ARRAY['/demo/truck-tank-1.jpg']::TEXT[], NULL, NULL,
  NULL, 1, NULL, NULL, 'TANK', 22, 3,
  ARRAY['UZ-BU', 'UZ-NW', 'UZ-XO', 'UZ-QR']::TEXT[], '[{"from":"UZ-BU","to":"UZ-XO"}]'::jsonb, NULL, 2, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-18', 'namuna-tentli-20t-buxoro-toshkent', 'demo-org-04', 'demo-user-04', 'TRUCK'::"ListingKind", NULL, 'ACTIVE'::"ListingStatus",
  'Tentli 20 t, Buxoro-Toshkent', 'Buxorodan Toshkentga haftada ikki marta, yo''lda Navoiy va Samarqandda yuk olamiz.', 'UZ-BU', 39.775, 64.429, 410000000::BIGINT,
  'PER_TRIP'::"PriceUnit", ARRAY['/demo/truck-tent-2.jpg', '/demo/truck-tent-3.jpg']::TEXT[], NULL, NULL,
  NULL, 1, NULL, NULL, 'TENT', 20, 5,
  ARRAY['UZ-BU', 'UZ-NW', 'UZ-SA', 'UZ-TK']::TEXT[], '[{"from":"UZ-BU","to":"UZ-TK"}]'::jsonb, NULL, 2, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-19', 'namuna-ochiq-platforma-20t-texnika', 'demo-org-01', 'demo-user-01', 'TRUCK'::"ListingKind", NULL, 'ACTIVE'::"ListingStatus",
  'Ochiq platforma 20 t, texnika tashish', 'Traktor, generator va uskunalar tashiymiz. Yuklash uchun trap va mahkamlash tasmalari bor.', 'UZ-TK', 41.311, 69.28, 750000::BIGINT,
  'PER_KM'::"PriceUnit", ARRAY['/demo/excavator-1.jpg', '/demo/excavator-2.jpg']::TEXT[], NULL, NULL,
  NULL, 1, NULL, NULL, 'FLATBED', 20, 2,
  ARRAY['UZ-TK', 'UZ-TO', 'UZ-SI', 'UZ-JI']::TEXT[], '[{"from":"UZ-TK","to":"UZ-JI"}]'::jsonb, NULL, 2, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-20', 'namuna-agdaruvchi-15t-jizzax', 'demo-org-02', 'demo-user-02', 'TRUCK'::"ListingKind", NULL, 'ACTIVE'::"ListingStatus",
  'Ag''daruvchi 15 t, Jizzax', 'Jizzax va Samarqand qurilishlariga qum va shag''al. Kichik ko''chalarga ham kiradi.', 'UZ-SA', 39.655, 66.96, 3800000::BIGINT,
  'PER_TON'::"PriceUnit", ARRAY['/demo/truck-dump-2.jpg', '/demo/truck-dump-1.jpg']::TEXT[], NULL, NULL,
  NULL, 1, NULL, NULL, 'TIPPER', 15, 4,
  ARRAY['UZ-SA', 'UZ-JI']::TEXT[], '[{"from":"UZ-SA","to":"UZ-JI"}]'::jsonb, NULL, 2, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-21', 'namuna-manevr-teplovozi-tem2-ijara', 'demo-org-05', 'demo-user-05', 'SHUNTING_LOCO'::"ListingKind", 'RENT'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Manevr teplovozi TEM2 ijaraga', 'Zavod shahobcha yo''lida manevr uchun. Mashinist bilan yoki mashinistsiz, kelishiladi.', 'UZ-TK', 41.311, 69.28, 9500000000::BIGINT,
  'PER_MONTH'::"PriceUnit", ARRAY['/demo/loco-1.jpg', '/demo/loco-2.jpg']::TEXT[], 2007, 'GOOD'::"Condition",
  'TEM2', 1, NULL, 1200, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, 4, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-22', 'namuna-manevr-teplovozi-tgm4-sotuv', 'demo-org-06', 'demo-user-06', 'SHUNTING_LOCO'::"ListingKind", 'SALE'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Manevr teplovozi TGM4 sotuvga', 'Dvigatel kapital ta''mir talab qiladi, ramasi va g''ildiraklari yaxshi. Ko''rib olish mumkin.', 'UZ-NW', 40.084, 65.379, 190000000000::BIGINT,
  'TOTAL'::"PriceUnit", ARRAY['/demo/loco-2.jpg', '/demo/loco-3.jpg']::TEXT[], 1998, 'NEEDS_REPAIR'::"Condition",
  'TGM4', 1, NULL, 800, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, 24, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-23', 'namuna-manevr-teplovozi-tgm6-ijara', 'demo-org-07', 'demo-user-07', 'SHUNTING_LOCO'::"ListingKind", 'RENT'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Manevr teplovozi TGM6 ijaraga', 'Qarshi tugunida turibdi. Soatlik emas, oylik ijara, yoqilg''i buyurtmachidan.', 'UZ-QA', 38.861, 65.789, 11000000000::BIGINT,
  'PER_MONTH'::"PriceUnit", ARRAY['/demo/loco-3.jpg', '/demo/loco-1.jpg']::TEXT[], 2011, 'GOOD'::"Condition",
  'TGM6', 1, NULL, 1000, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, 6, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-24', 'namuna-manevr-teplovozi-tem18-ijara', 'demo-org-06', 'demo-user-06', 'SHUNTING_LOCO'::"ListingKind", 'RENT'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Manevr teplovozi TEM18 ijaraga', 'Yangi avlod teplovoz, kam yoqilg''i sarflaydi. Navoiy va Buxoro shahobchalariga chiqamiz.', 'UZ-NW', 40.084, 65.379, 14000000000::BIGINT,
  'PER_MONTH'::"PriceUnit", ARRAY['/demo/loco-1.jpg', '/demo/loco-2.jpg']::TEXT[], 2015, 'GOOD'::"Condition",
  'TEM18DM', 1, NULL, 1300, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, 8, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";
INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",
  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",
  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",
  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-listing-25', 'namuna-manevr-teplovozi-tgk2-sotuv', 'demo-org-05', 'demo-user-05', 'SHUNTING_LOCO'::"ListingKind", 'SALE'::"DealKind", 'ACTIVE'::"ListingStatus",
  'Manevr teplovozi TGK2 sotuvga', 'Kichik shahobcha va ombor yo''llari uchun yengil teplovoz. Ishlayotgan holatda, hujjatlari tartibda.', 'UZ-TK', 41.311, 69.28, 65000000000::BIGINT,
  'TOTAL'::"PriceUnit", ARRAY['/demo/loco-2.jpg', '/demo/loco-3.jpg']::TEXT[], 2003, 'GOOD'::"Condition",
  'TGK2', 1, NULL, 400, NULL, NULL, NULL,
  ARRAY[]::TEXT[], '[]'::jsonb, NULL, 12, now(), NULL, NULL, true, now(), now())
ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";

INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-01', 'demo-user-08', 'demo-org-08', 'FORWARDER', 'Vagon buyurtma va yuk kuzatuvi, Toshkent tuguni', 'Vagon so''rovidan yuk yetib borguncha bitta odam javob beradi. Har kuni vagon qayerdaligini xabar qilamiz. Don, un, qurilish materiallari bilan ko''p ishlaganmiz.', ARRAY['UZ-TK', 'UZ-TO']::TEXT[],
  9, 'kelishiladi, yuk hajmiga qarab', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-02', 'demo-user-09', 'demo-org-09', 'FORWARDER', 'Eksport yuklarini Qozog''iston va Rossiyaga jo''natish', 'Meva-sabzavot eksporti mavsumida har kuni 5-10 vagon jo''natamiz. Chegara stansiyalarida o''z odamlarimiz bor. Hujjat va kuzatuv bir paketda.', ARRAY['UZ-XO', 'UZ-QR']::TEXT[],
  12, '1 vagon uchun 1 200 000 so''mdan', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-03', 'demo-user-13', NULL, 'FORWARDER', 'Konteyner yuklari, Chuqursoy va Angren', 'Konteynerni terminaldan olib, vagonga yuklash va manzilga yetkazishni tashkil qilamiz. Xitoy va Koreya yo''nalishida tajriba bor.', ARRAY['UZ-TK', 'UZ-TO', 'UZ-FA']::TEXT[],
  6, '1 konteyner uchun 900 000 so''m', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-04', 'demo-user-14', NULL, 'FORWARDER', 'Vodiy korxonalari uchun ekspeditor', 'Farg''ona vodiysidagi zavodlar uchun xom ashyo keltirish va tayyor mahsulot jo''natish. Vagon topish qiyin paytlarda ham yechim topamiz.', ARRAY['UZ-FA', 'UZ-AN', 'UZ-NG']::TEXT[],
  7, 'kelishiladi', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-05', 'demo-user-15', NULL, 'FORWARDER', 'Samarqand va Jizzax, don va o''g''it yuklari', 'Don va mineral o''g''itlarni vagonda jo''natish. Elevator va omborlar bilan bevosita aloqa. Vagon ostida turish vaqtini kamaytiramiz.', ARRAY['UZ-SA', 'UZ-JI']::TEXT[],
  10, '1 tonna uchun 25 000 so''mdan', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-06', 'demo-user-16', NULL, 'FORWARDER', 'Buxoro va Navoiy, sanoat yuklari', 'Sement, metall va kimyo mahsulotlari bo''yicha ekspeditsiya. Yarim vagon va xopper buyurtma qilamiz, yuklashni nazorat qilamiz.', ARRAY['UZ-BU', 'UZ-NW']::TEXT[],
  8, 'kelishiladi', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-07', 'demo-user-17', NULL, 'FORWARDER', 'Qashqadaryo, Surxondaryo, janub yo''nalishi', 'Janubdan Toshkentga va shimolga yuk jo''natish. Termiz orqali Afg''oniston yo''nalishida ham ishlaymiz.', ARRAY['UZ-QA', 'UZ-SU']::TEXT[],
  5, '1 vagon uchun 800 000 so''mdan', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-08', 'demo-user-18', NULL, 'FORWARDER', 'Avto va temir yo''l aralash tashuv', 'Yukni avtoda stansiyaga keltirib, vagonga yuklab, manzilda yana avto bilan yetkazamiz. Bir shartnoma, bir javobgar.', ARRAY['UZ-TK', 'UZ-SI', 'UZ-JI']::TEXT[],
  11, 'kelishiladi', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-09', 'demo-user-19', NULL, 'FORWARDER', 'Kichik partiyalar, yig''ma vagon', 'Bir vagonga yetmaydigan yuklarni boshqalar bilan birga jo''natamiz. Haftada ikki marta Toshkentdan vodiyga va Samarqandga.', ARRAY['UZ-TK', 'UZ-TO']::TEXT[],
  4, '1 tonna uchun 40 000 so''mdan', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-10', 'demo-user-20', NULL, 'FORWARDER', 'Xorazm, paxta va tekstil yuklari', 'Paxta tolasi va tayyor to''qimachilik mahsulotlarini eksportga jo''natish. Bojxona hujjatlari ham bir joyda.', ARRAY['UZ-XO', 'UZ-BU']::TEXT[],
  14, 'kelishiladi', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-11', 'demo-user-21', NULL, 'CASHIER', 'Tovar kassiri, Toshkent-tovar stansiyasi', 'Yuk xati va vagon hujjatlarini to''ldirib, stansiyada topshiraman. Xato tufayli vagon turib qolmasligi uchun avval tekshirib chiqaman.', ARRAY['UZ-TK']::TEXT[],
  15, '1 hujjat 150 000 so''m', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-12', 'demo-user-22', NULL, 'CASHIER', 'Tovar kassiri, Sergeli va Chuqursoy', 'Kunlik ish: yuk xati, hisob-kitob varaqasi, tarif hisoblash. Ertalab topshirsangiz kechgacha tayyor.', ARRAY['UZ-TK', 'UZ-TO']::TEXT[],
  8, '1 vagon 120 000 so''m', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-13', 'demo-user-23', NULL, 'CASHIER', 'Tovar kassiri, Samarqand stansiyasi', 'Samarqand va Kattaqo''rg''on stansiyalarida yuk hujjatlarini rasmiylashtiraman. Tarif hisobida xato bo''lmaydi.', ARRAY['UZ-SA']::TEXT[],
  11, 'kelishiladi', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-14', 'demo-user-24', NULL, 'CASHIER', 'Tovar kassiri, Andijon va Asaka', 'Vodiydan jo''nayotgan vagonlar uchun hujjat to''plami. Eksport yuklarida bojxona bilan kelishib ishlayman.', ARRAY['UZ-AN']::TEXT[],
  6, '1 hujjat 130 000 so''m', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-15', 'demo-user-25', NULL, 'CASHIER', 'Tovar kassiri, Navoiy tuguni', 'Sanoat yuklari: sement, metall, kimyo. Ko''p vagonli jo''natmalarda chegirma bor.', ARRAY['UZ-NW']::TEXT[],
  9, '1 vagon 110 000 so''m', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-16', 'demo-user-26', NULL, 'CASHIER', 'Tovar kassiri, Buxoro va Qorako''l', 'Yuk xati, plomba dalolatnomasi, og''irlik hujjatlari. Kechqurun ham telefonda javob beraman.', ARRAY['UZ-BU']::TEXT[],
  7, 'kelishiladi', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-17', 'demo-user-27', NULL, 'CASHIER', 'Tovar kassiri, Qarshi stansiyasi', 'Qashqadaryodan don va g''isht jo''natmalari bo''yicha tajriba katta. Hujjat qaytib kelsa o''zim to''g''irlab beraman.', ARRAY['UZ-QA']::TEXT[],
  10, '1 hujjat 120 000 so''m', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-18', 'demo-user-28', NULL, 'CASHIER', 'Tovar kassiri, Urganch', 'Xorazm va Qoraqalpog''iston stansiyalarida eksport yuklarini rasmiylashtiraman. Meva mavsumida oldindan yozib qo''ying.', ARRAY['UZ-XO', 'UZ-QR']::TEXT[],
  12, 'kelishiladi', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-19', 'demo-user-29', NULL, 'CASHIER', 'Tovar kassiri, Jizzax va Guliston', 'Don va un yuklari bo''yicha hujjatlar. Elevatorga o''zim borib, joyida to''ldiraman.', ARRAY['UZ-JI', 'UZ-SI']::TEXT[],
  5, '1 vagon 100 000 so''m', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-20', 'demo-user-30', NULL, 'CASHIER', 'Tovar kassiri, Termiz', 'Termiz chegara stansiyasida tranzit va eksport hujjatlari. Afg''oniston yo''nalishida alohida tajriba.', ARRAY['UZ-SU']::TEXT[],
  13, '1 hujjat 160 000 so''m', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-21', 'demo-user-10', 'demo-org-10', 'DOCS', 'Bojxona deklaratsiyasi, eksport va import', 'Eksport-import deklaratsiyalarini bir kunda tayyorlaymiz. Kod tanlashda xato bo''lmasligi uchun tovarni oldin ko''rib chiqamiz.', ARRAY['UZ-TK', 'UZ-TO']::TEXT[],
  10, '1 deklaratsiya 350 000 so''mdan', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-22', 'demo-user-11', 'demo-org-11', 'DOCS', 'Kelib chiqish sertifikati va ruxsatnomalar', 'Sertifikat, fitosanitar va veterinariya ruxsatnomalarini olib beramiz. Qaysi hujjat kerakligini tovar bo''yicha aytamiz.', ARRAY['UZ-TK']::TEXT[],
  7, 'kelishiladi', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-23', 'demo-user-31', NULL, 'DOCS', 'Vodiy uchun bojxona hujjatlari', 'Andijon va Farg''ona postlarida rasmiylashtiruv. Korxonaga borib, hujjat yig''ib ketamiz.', ARRAY['UZ-FA', 'UZ-AN', 'UZ-NG']::TEXT[],
  9, '1 deklaratsiya 300 000 so''m', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-24', 'demo-user-32', NULL, 'DOCS', 'Shartnoma va yuk hujjatlari to''plami', 'Tashuv shartnomasi, yuk xati, invoys va o''ram ro''yxatini bir shakl bo''yicha tayyorlaymiz. Bankka ham topshirishga yaraydi.', ARRAY['UZ-SA', 'UZ-JI']::TEXT[],
  6, '1 to''plam 250 000 so''m', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-25', 'demo-user-33', NULL, 'DOCS', 'Eksport hujjatlari, meva-sabzavot', 'Meva-sabzavot eksporti uchun to''liq hujjat: deklaratsiya, fitosanitar, sifat sertifikati. Mavsumda kechasi ham ishlaymiz.', ARRAY['UZ-XO', 'UZ-BU', 'UZ-QR']::TEXT[],
  11, 'kelishiladi', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-26', 'demo-user-34', NULL, 'DOCS', 'Import rasmiylashtiruvi, uskunalar', 'Xitoy va Turkiyadan keladigan uskunalar uchun import hujjatlari. Imtiyoz kodlarini bilamiz, ortiqcha to''lamaysiz.', ARRAY['UZ-TK', 'UZ-SI']::TEXT[],
  8, '1 deklaratsiya 400 000 so''mdan', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-27', 'demo-user-35', NULL, 'DOCS', 'Bojxona hujjatlari, Navoiy va Buxoro', 'Sanoat korxonalari uchun doimiy xizmat: oyiga bir to''lov, hujjat soni cheklanmagan.', ARRAY['UZ-NW', 'UZ-BU']::TEXT[],
  5, 'kelishiladi', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-28', 'demo-user-36', NULL, 'DOCS', 'Tranzit hujjatlari, Termiz', 'Afg''oniston va Pokiston yo''nalishida tranzit rasmiylashtiruvi. Chegara postida o''z vakilimiz bor.', ARRAY['UZ-SU', 'UZ-QA']::TEXT[],
  12, '1 hujjat 380 000 so''m', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-29', 'demo-user-37', NULL, 'DOCS', 'Temir yo''l yuk hujjatlari, maslahat', 'Birinchi marta vagon jo''natayotganlar uchun: qaysi hujjat, qayerga, qachon. Hujjatni o''zingiz to''ldirasiz, biz tekshiramiz.', ARRAY['UZ-TK', 'UZ-TO', 'UZ-SA']::TEXT[],
  14, '1 soat maslahat 200 000 so''m', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",
  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-service-30', 'demo-user-38', NULL, 'DOCS', 'Sertifikatlash va markirovka', 'Majburiy sertifikat va markirovka hujjatlarini olib beramiz. Eksportga chiqayotgan kichik korxonalar uchun qulay.', ARRAY['UZ-AN', 'UZ-FA']::TEXT[],
  6, 'kelishiladi', NULL, 'ACTIVE', true, now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-01', 'CR' || '-' || nextval('market_no_seq'), 'CARGO',
  NULL, 'UZ-JI', 'UZ-JI', 'UZ-TK',
  'Jizzax, don ombori', 'Toshkent, Sergeli', 'Bug''doy uni, qopda', 20,
  (CURRENT_DATE + 2), 'TENT', 'Bug''doy uni, qopda, 20 t',
  'Qopda 20 tonna un. Yuklash ertalab, ombor yuklovchisi bor. Toshkentda tushirish bir joyda.', NULL, 'demo-user-12', 'demo-org-12',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-02', 'CR' || '-' || nextval('market_no_seq'), 'CARGO',
  NULL, 'UZ-FA', 'UZ-FA', 'UZ-TK',
  'Marg''ilon, fabrika', 'Toshkent, Yashnobod', 'Tayyor gazlama, rulonda', 12,
  (CURRENT_DATE + 3), 'TENT', 'Tayyor gazlama, rulonda, 12 t',
  'Rulonlar nam bo''lmasligi kerak, tent butun bo''lsin. Yuklash 2 soat.', NULL, 'demo-user-39', NULL,
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-03', 'CR' || '-' || nextval('market_no_seq'), 'CARGO',
  NULL, 'UZ-SA', 'UZ-SA', 'UZ-XO',
  'Samarqand, sovutgich ombori', 'Urganch', 'Olma, yashikda', 16,
  (CURRENT_DATE + 1), 'REF', 'Olma, yashikda, 16 t',
  'Harorat +2 dan +4 gacha. Kechasi yo''lga chiqsa yaxshi, ertalab Urganchda bo''lsin.', NULL, 'demo-user-40', NULL,
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-04', 'CR' || '-' || nextval('market_no_seq'), 'CARGO',
  NULL, 'UZ-TK', 'UZ-TK', 'UZ-BU',
  'Toshkent, Chuqursoy', 'Buxoro, sanoat zonasi', 'Uskuna, 2 ta konteyner 20 fut', 24,
  (CURRENT_DATE + 5), 'CONTAINER', 'Uskuna, 2 ta konteyner 20 fut, 24 t',
  'Ikki konteyner, bitta mashinaga sig''adi. Terminalda yuklash navbati bor, oldindan kelish kerak.', NULL, 'demo-user-08', 'demo-org-08',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-05', 'CR' || '-' || nextval('market_no_seq'), 'CARGO',
  NULL, 'UZ-NW', 'UZ-NW', 'UZ-SA',
  'Navoiy, karer', 'Samarqand, qurilish', 'Shag''al', 25,
  (CURRENT_DATE + 1), 'TIPPER', 'Shag''al, 25 t',
  'Har kuni 4-5 reys, bir hafta davomida. Bir mashina emas, bir nechta kerak.', NULL, 'demo-user-09', 'demo-org-09',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-06', 'CR' || '-' || nextval('market_no_seq'), 'CARGO',
  NULL, 'UZ-AN', 'UZ-AN', 'UZ-TK',
  'Andijon, avtozavod hududi', 'Toshkent, Yangihayot', 'Avto ehtiyot qismlar, palletda', 8,
  (CURRENT_DATE + 4), 'TENT', 'Avto ehtiyot qismlar, palletda, 8 t',
  '22 pallet, ehtiyot qismlar. Yuk qimmat, sug''urta bo''lsa afzal.', NULL, 'demo-user-12', 'demo-org-12',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-07', 'CR' || '-' || nextval('market_no_seq'), 'CARGO',
  NULL, 'UZ-QA', 'UZ-QA', 'UZ-TK',
  'Qarshi', 'Toshkent, Qo''yliq', 'Kartoshka, qopda', 20,
  (CURRENT_DATE + 2), 'TENT', 'Kartoshka, qopda, 20 t',
  'Bozorga ertalab yetib borishi kerak. Yuklash kechqurun, dalada.', NULL, 'demo-user-39', NULL,
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-08', 'CR' || '-' || nextval('market_no_seq'), 'CARGO',
  NULL, 'UZ-BU', 'UZ-BU', 'UZ-NW',
  'Buxoro, moy zavodi', 'Navoiy', 'Paxta moyi', 20,
  (CURRENT_DATE + 6), 'TANK', 'Paxta moyi, 20 t',
  'Oziq-ovqat sisternasi kerak, yuvilgan va dalolatnomasi bilan. Ikki reys.', NULL, 'demo-user-40', NULL,
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-09', 'CR' || '-' || nextval('market_no_seq'), 'CARGO',
  NULL, 'UZ-TK', 'UZ-TK', 'UZ-SU',
  'Toshkent, Sergeli', 'Termiz', 'Qurilish texnikasi, ekskavator', 18,
  (CURRENT_DATE + 7), 'FLATBED', 'Qurilish texnikasi, ekskavator, 18 t',
  'Bitta ekskavator, o''zi chiqadi. Balandligi 3,2 metr, yo''lda ko''prik bor-yo''qligini tekshiring.', NULL, 'demo-user-08', 'demo-org-08',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-10', 'CR' || '-' || nextval('market_no_seq'), 'CARGO',
  NULL, 'UZ-XO', 'UZ-XO', 'UZ-TK',
  'Xiva', 'Toshkent, Chilonzor', 'Qovun, yashikda', 14,
  (CURRENT_DATE + 3), 'REF', 'Qovun, yashikda, 14 t',
  'Mavsum yuki, 3 kun ichida jo''nashi kerak. Sovutgich +8 atrofida.', NULL, 'demo-user-12', 'demo-org-12',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-11', 'SR' || '-' || nextval('market_no_seq'), 'SERVICE',
  'FORWARDER', 'UZ-JI', NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, 'Har oy 40 vagon un jo''natishga ekspeditor kerak',
  'Jizzaxdan Toshkent va Farg''onaga. Vagon buyurtma va kuzatuvni to''liq topshirmoqchimiz, oylik shartnoma.', NULL, 'demo-user-12', 'demo-org-12',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-12', 'SR' || '-' || nextval('market_no_seq'), 'SERVICE',
  'CASHIER', 'UZ-TK', NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, 'Toshkent-tovar uchun tovar kassiri, doimiy',
  'Haftada 10-15 vagon jo''natamiz, hujjatlarni o''zimiz to''ldirishga ulgurmayapmiz. Doimiy odam kerak.', NULL, 'demo-user-01', 'demo-org-01',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-13', 'SR' || '-' || nextval('market_no_seq'), 'SERVICE',
  'DOCS', 'UZ-FA', NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, 'Birinchi eksport: Qozog''istonga meva, hujjat kerak',
  'Ilgari eksport qilmaganmiz. Qaysi hujjat kerak, qancha vaqt ketadi, shuni tushuntirib, tayyorlab bersa.', NULL, 'demo-user-02', 'demo-org-02',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-14', 'SR' || '-' || nextval('market_no_seq'), 'SERVICE',
  'FORWARDER', 'UZ-XO', NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, 'Meva mavsumida 5 vagon kunlik jo''natma',
  'Iyul-avgustda har kuni 3-5 refrijerator vagon. Vagon topish va chegara hujjatlari bilan yordam kerak.', NULL, 'demo-user-09', 'demo-org-09',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-15', 'SR' || '-' || nextval('market_no_seq'), 'SERVICE',
  'DOCS', 'UZ-TK', NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, 'Xitoydan uskuna importi, deklaratsiya',
  'Ikki konteyner uskuna keladi. Import deklaratsiyasi va imtiyoz kodlari bo''yicha mutaxassis kerak.', NULL, 'demo-user-03', 'demo-org-03',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-16', 'SR' || '-' || nextval('market_no_seq'), 'SERVICE',
  'CASHIER', 'UZ-SA', NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, 'Samarqand stansiyasida 20 vagon uchun hujjat',
  'Bir martalik ish: 20 yarim vagon shag''al jo''natiladi, yuk xatlari va tarif hisobini to''ldirish kerak.', NULL, 'demo-user-04', 'demo-org-04',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-17', 'SR' || '-' || nextval('market_no_seq'), 'SERVICE',
  'FORWARDER', 'UZ-NW', NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, 'Sement jo''natish, xopper vagon topish',
  'Oyiga 30 xopper. Vagon topish qiyin, kim doimiy yechim bera oladi?', NULL, 'demo-user-05', 'demo-org-05',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-18', 'SR' || '-' || nextval('market_no_seq'), 'SERVICE',
  'DOCS', 'UZ-AN', NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, 'Tekstil eksporti, sertifikat va deklaratsiya',
  'Turkiyaga gazlama eksporti. Kelib chiqish sertifikati va deklaratsiya bir joyda bo''lsa yaxshi.', NULL, 'demo-user-06', 'demo-org-06',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-19', 'SR' || '-' || nextval('market_no_seq'), 'SERVICE',
  'CASHIER', 'UZ-SU', NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, 'Termizda tranzit vagonlar uchun kassir',
  'Afg''onistonga tranzit, haftada 6-8 vagon. Chegara stansiyasida tajribasi bor odam kerak.', NULL, 'demo-user-07', 'demo-org-07',
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",
  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",
  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-request-20', 'SR' || '-' || nextval('market_no_seq'), 'SERVICE',
  'FORWARDER', 'UZ-TK', NULL, NULL,
  NULL, NULL, NULL, NULL,
  NULL, NULL, 'Kichik partiya, yig''ma vagon Farg''onaga',
  '3 tonna yuk, vagonga yetmaydi. Kim yig''ma vagon bilan Farg''onaga jo''natadi?', NULL, 'demo-user-40', NULL,
  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Terminal" ("id", "slug", "orgId", "stationId", "kind", "name", "description", "address", "phone",
  "lat", "lng", "is24h", "hours", "passport", "photos", "status", "claimStatus", "claimedAt", "regionCode", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-terminal-01', 'namuna-sergeli-konteyner-maydoni', 'demo-org-21', (SELECT "id" FROM "Station" WHERE "nameRu" = 'Сергели' LIMIT 1), 'MULTI'::"TerminalKind", 'Sergeli konteyner maydoni', 'Konteyner va qadoqlangan yuk uchun maydon. Vagondan avtoga ortamiz, saqlash uchun ochiq va yopiq joy bor. Kechasi ham ishlaymiz.', 'Toshkent sh., Sergeli tumani', NULL,
  41.217, 69.218, true, NULL, '{"tracks":6,"tracksLengthM":3200,"cranes":[{"type":"Kozlovoy kran","capacityT":32},{"type":"Richstaker","capacityT":45}],"warehouseM2":4200,"openAreaM2":28000,"hasScale":true,"scaleT":120}'::jsonb, ARRAY['/demo/terminal-container-1.jpg', '/demo/terminal-container-2.jpg', '/demo/terminal-container-3.jpg', '/demo/terminal-crane-1.jpg']::TEXT[],
  'ACTIVE'::"TerminalStatus", 'APPROVED'::"ClaimStatus", now(), 'UZ-TK', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-01-load', 'demo-terminal-01', 'LOAD'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-01-unload', 'demo-terminal-01', 'UNLOAD'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-01-container', 'demo-terminal-01', 'CONTAINER'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-01-storage', 'demo-terminal-01', 'STORAGE'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-01-weigh', 'demo-terminal-01', 'WEIGH'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-01-tar-1', 'demo-terminal-01', 'LOAD'::"ServiceCode", 1, now() - interval '1 day',
  18000000::BIGINT, 'PER_TON'::"TariffUnit", 90000000::BIGINT, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-01-tar-2', 'demo-terminal-01', 'UNLOAD'::"ServiceCode", 1, now() - interval '1 day',
  16000000::BIGINT, 'PER_TON'::"TariffUnit", 80000000::BIGINT, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-01-tar-3', 'demo-terminal-01', 'CONTAINER'::"ServiceCode", 1, now() - interval '1 day',
  140000000::BIGINT, 'PER_OPERATION'::"TariffUnit", NULL, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-01-tar-4', 'demo-terminal-01', 'STORAGE'::"ServiceCode", 1, now() - interval '1 day',
  3800000::BIGINT, 'PER_DAY'::"TariffUnit", NULL, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-01-tar-5', 'demo-terminal-01', 'WEIGH'::"ServiceCode", 1, now() - interval '1 day',
  12000000::BIGINT, 'PER_WAGON'::"TariffUnit", NULL, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "TimeSlot" ("id", "terminalId", "localDate", "window", "startsAt", "endsAt", "capacity", "createdAt", "updatedAt")
SELECT replace(gen_random_uuid()::text, '-', ''), 'demo-terminal-01', d::date, w.win,
       ((d::date + w.a::time) AT TIME ZONE 'Asia/Tashkent'), ((d::date + w.b::time) AT TIME ZONE 'Asia/Tashkent'), 4, now(), now()
FROM generate_series(CURRENT_DATE, CURRENT_DATE + 179, interval '1 day') d
CROSS JOIN (VALUES (1, '08:00', '10:00'), (2, '10:00', '12:00'), (3, '12:00', '14:00'), (4, '14:00', '16:00'), (5, '16:00', '18:00'), (6, '18:00', '20:00')) AS w(win, a, b)
ON CONFLICT ("terminalId", "localDate", "window") DO NOTHING;

INSERT INTO "Terminal" ("id", "slug", "orgId", "stationId", "kind", "name", "description", "address", "phone",
  "lat", "lng", "is24h", "hours", "passport", "photos", "status", "claimStatus", "claimedAt", "regionCode", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-terminal-02', 'namuna-navoiy-yuk-maydoni', 'demo-org-22', (SELECT "id" FROM "Station" WHERE "nameRu" = 'Навои' LIMIT 1), 'RAIL'::"TerminalKind", 'Navoiy yuk maydoni', 'Sochiluvchi yuklar uchun ochiq maydon: ko''mir, shag''al, mineral o''g''it. Vagonni ag''daramiz va avtoga ortamiz.', 'Navoiy viloyati, Navoiy sh.', NULL,
  40.0844, 65.3792, false, '{"mon":[["08:00","18:00"]],"tue":[["08:00","18:00"]],"wed":[["08:00","18:00"]],"thu":[["08:00","18:00"]],"fri":[["08:00","18:00"]],"sat":[["08:00","14:00"]]}'::jsonb, '{"tracks":3,"tracksLengthM":1800,"cranes":[{"type":"Kozlovoy kran","capacityT":20}],"warehouseM2":0,"openAreaM2":19000,"hasScale":true,"scaleT":100}'::jsonb, ARRAY['/demo/terminal-rail-1.jpg', '/demo/terminal-rail-2.jpg', '/demo/terminal-crane-2.jpg', '/demo/terminal-rail-3.jpg']::TEXT[],
  'ACTIVE'::"TerminalStatus", 'APPROVED'::"ClaimStatus", now(), 'UZ-NW', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-02-load', 'demo-terminal-02', 'LOAD'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-02-unload', 'demo-terminal-02', 'UNLOAD'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-02-storage', 'demo-terminal-02', 'STORAGE'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-02-weigh', 'demo-terminal-02', 'WEIGH'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-02-tar-1', 'demo-terminal-02', 'LOAD'::"ServiceCode", 1, now() - interval '1 day',
  14000000::BIGINT, 'PER_TON'::"TariffUnit", 70000000::BIGINT, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-02-tar-2', 'demo-terminal-02', 'UNLOAD'::"ServiceCode", 1, now() - interval '1 day',
  13000000::BIGINT, 'PER_TON'::"TariffUnit", 65000000::BIGINT, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-02-tar-3', 'demo-terminal-02', 'STORAGE'::"ServiceCode", 1, now() - interval '1 day',
  2600000::BIGINT, 'PER_DAY'::"TariffUnit", NULL, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-02-tar-4', 'demo-terminal-02', 'WEIGH'::"ServiceCode", 1, now() - interval '1 day',
  11000000::BIGINT, 'PER_WAGON'::"TariffUnit", NULL, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "TimeSlot" ("id", "terminalId", "localDate", "window", "startsAt", "endsAt", "capacity", "createdAt", "updatedAt")
SELECT replace(gen_random_uuid()::text, '-', ''), 'demo-terminal-02', d::date, w.win,
       ((d::date + w.a::time) AT TIME ZONE 'Asia/Tashkent'), ((d::date + w.b::time) AT TIME ZONE 'Asia/Tashkent'), 3, now(), now()
FROM generate_series(CURRENT_DATE, CURRENT_DATE + 179, interval '1 day') d
CROSS JOIN (VALUES (1, '08:00', '10:00'), (2, '10:00', '12:00'), (3, '12:00', '14:00'), (4, '14:00', '16:00'), (5, '16:00', '18:00'), (6, '18:00', '20:00')) AS w(win, a, b)
ON CONFLICT ("terminalId", "localDate", "window") DO NOTHING;

INSERT INTO "Terminal" ("id", "slug", "orgId", "stationId", "kind", "name", "description", "address", "phone",
  "lat", "lng", "is24h", "hours", "passport", "photos", "status", "claimStatus", "claimedAt", "regionCode", "isDemo", "createdAt", "updatedAt")
VALUES ('demo-terminal-03', 'namuna-chuqursoy-ombor-terminali', 'demo-org-23', (SELECT "id" FROM "Station" WHERE "nameRu" = 'Чукурсай' LIMIT 1), 'MULTI'::"TerminalKind", 'Chuqursoy ombor terminali', 'Yopiq ombor va yuk maydoni. Qadoqlangan mahsulot saqlaymiz, shahar ichiga kichik mashinalarda yetkazib beramiz.', 'Toshkent sh., Uchtepa tumani', NULL,
  41.328, 69.201, false, '{"mon":[["08:00","18:00"]],"tue":[["08:00","18:00"]],"wed":[["08:00","18:00"]],"thu":[["08:00","18:00"]],"fri":[["08:00","18:00"]],"sat":[["08:00","14:00"]]}'::jsonb, '{"tracks":2,"tracksLengthM":1100,"cranes":[{"type":"Kozlovoy kran","capacityT":16}],"warehouseM2":6800,"openAreaM2":9000,"hasScale":true,"scaleT":80}'::jsonb, ARRAY['/demo/terminal-warehouse-1.jpg', '/demo/terminal-warehouse-2.jpg', '/demo/terminal-warehouse-3.jpg']::TEXT[],
  'ACTIVE'::"TerminalStatus", 'APPROVED'::"ClaimStatus", now(), 'UZ-TK', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-03-load', 'demo-terminal-03', 'LOAD'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-03-unload', 'demo-terminal-03', 'UNLOAD'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-03-storage', 'demo-terminal-03', 'STORAGE'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")
VALUES ('demo-terminal-03-last_mile', 'demo-terminal-03', 'LAST_MILE'::"ServiceCode", true, 0)
ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-03-tar-1', 'demo-terminal-03', 'LOAD'::"ServiceCode", 1, now() - interval '1 day',
  17000000::BIGINT, 'PER_TON'::"TariffUnit", 85000000::BIGINT, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-03-tar-2', 'demo-terminal-03', 'UNLOAD'::"ServiceCode", 1, now() - interval '1 day',
  15000000::BIGINT, 'PER_TON'::"TariffUnit", 75000000::BIGINT, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-03-tar-3', 'demo-terminal-03', 'STORAGE'::"ServiceCode", 1, now() - interval '1 day',
  4200000::BIGINT, 'PER_DAY'::"TariffUnit", NULL, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")
VALUES ('demo-terminal-03-tar-4', 'demo-terminal-03', 'LAST_MILE'::"ServiceCode", 1, now() - interval '1 day',
  90000000::BIGINT, 'PER_OPERATION'::"TariffUnit", NULL, NULL, now())
ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;
INSERT INTO "TimeSlot" ("id", "terminalId", "localDate", "window", "startsAt", "endsAt", "capacity", "createdAt", "updatedAt")
SELECT replace(gen_random_uuid()::text, '-', ''), 'demo-terminal-03', d::date, w.win,
       ((d::date + w.a::time) AT TIME ZONE 'Asia/Tashkent'), ((d::date + w.b::time) AT TIME ZONE 'Asia/Tashkent'), 3, now(), now()
FROM generate_series(CURRENT_DATE, CURRENT_DATE + 179, interval '1 day') d
CROSS JOIN (VALUES (1, '08:00', '10:00'), (2, '10:00', '12:00'), (3, '12:00', '14:00'), (4, '14:00', '16:00'), (5, '16:00', '18:00'), (6, '18:00', '20:00')) AS w(win, a, b)
ON CONFLICT ("terminalId", "localDate", "window") DO NOTHING;

