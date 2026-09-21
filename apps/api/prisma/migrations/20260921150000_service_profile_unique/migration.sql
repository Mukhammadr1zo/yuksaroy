-- Bir odamda har xizmat turidan bitta profil: ilgari faqat o'qib-keyin-yozish tekshiruvi bor edi,
-- ikki so'rov bir vaqtda kelsa ikkita profil ochilardi.
CREATE UNIQUE INDEX "ServiceProfile_userId_serviceType_key" ON "ServiceProfile"("userId", "serviceType");
