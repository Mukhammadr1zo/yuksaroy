# YukSaroy mobil ilova dizayni v2 "Xarita ustida" (2026-09-09)

Vizual hujjat (ikonka, dizayn tizimi, navigatsiya, 35 ekran, holatlar, tungi rejim, tillar, texnik yo'l, savollar):
https://claude.ai/code/artifact/73607666-8b8d-41ac-834b-a502b8b2396c

## Uslub

Birinchi variant (oq kartalar, tekis ro'yxatlar) egasi tomonidan "juda oddiy" deb rad etildi. Qabul qilingan yo'nalish "Xarita ustida": saytdagi qahramon xarita ilovaning ham qahramoni.

Imzo komponentlari:

- **Tungi xarita** bosh sahifa, terminal va kirish ekranlarining yuqori qismida (plate #0A1626, qog'oz #F6F1E7); ustida shisha panellar.
- **Chipta** buyurtma kartasi: chap chekkada holat rangi, yirtiq chizig'i, pastda faqat keyingi harakat.
- **Naryad** qora chek: narx yig'indisi, solishtirish jadvali, yakuniy hisob.
- **Slot tasmasi** vaqt o'qida: sig'im bloklari va puls bilan "hozir" belgisi.
- **Halqa taymer**: slot 10 daqiqa ushlab turilishi, terminal javobi SLA.
- **Suzuvchi shisha tab bar** ildiz ekranlarda.

## Qisqacha

- Bitta ilova, to'rt rol: yuk egasi (sukut), terminal egasi, texnika egasi, yakka haydovchi. Rol profil orqali, tab nomlari o'zgarmaydi.
- Beshta tab: Bosh, Qidiruv, Xarita, Buyurtmalar, Profil. Formalar va bron qadamlarida tab o'rniga pastdagi asosiy tugma (Telegram MainButton bilan bir xil qoida).
- Ranglar, shriftlar va matn bazasi saytdagi bilan bir xil (`apps/web/app/globals.css`, `apps/web/messages/<locale>`).
- Ikonka: saytdagi belgi och fonda, matn yo'q, iOS light/dark/tinted, Android adaptive/monochrome.
- Texnik tavsiya: Expo (React Native), `packages/domain` o'zgarishsiz, MapLibre React Native, Expo Notifications.

## Ekranlar

| Guruh | Raqamlar | Ekranlar |
|---|---|---|
| Kirish oqimi | 01-08 | Splash, onboarding, kirish, kod, rol tanlash, profil to'ldirish, bosh sahifa, bildirishnomalar |
| Qidiruv va xarita | 09-15 | Yordamchi, natijalar, filtr varag'i, xarita, koridor, terminal sahifasi, solishtirish |
| Bron va buyurtmalar | 16-23 | Bron 3 qadam, yaratildi, ro'yxat, buyurtma sahifasi, baho, hujjatlar |
| E'lonlar, shoshilinch, profil, egalar | 24-33 | Texnika, e'lon, narx so'rash, avtotransport, haydovchi e'loni, shoshilinch so'rov va takliflar, profil, terminal taxtasi, slotlar |
| Holatlar | 34a-35b | Bo'sh holatlar, offline va keshdagi ma'lumot, tungi rejim (07 va 14 ning aynan nusxasi) |

## Javob kutayotgan savollar (taklif javoblar hujjatning 11-bo'limida)

04 kod kanali, 05 tashkilot turi qadami, 06 parol majburiyligi, 10 viloyatda terminal yo'q holati, 12 klaster sanog'i, 14 ish vaqtidan tashqari oyna, 20 DONE buyurtma segmenti, 21 tarozi bo'yicha qayta hisob, 24 ijara filtri, 30 KYC siz takliflar, 33 oyna bo'yicha sig'im.

## Manba

Maketlar HTML+CSS da chizilgan (rasm emas; 38 ekran, jonli animatsiya bilan), shuning uchun Figma bosqichisiz to'g'ridan-to'g'ri Expo komponentlariga o'tkazsa bo'ladi. Manba fayllar sessiya scratchpad `mobile/` papkasida; artefakt versiyalari claude.ai da saqlanadi.
