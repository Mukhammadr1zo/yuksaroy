# YukSaroy — Bozor, raqobat va GTM (lens: market)

Rol: Strategy/GTM Lead. Sana: 2026-09-03. Manbalar oxirida; lokal fayllar (Desktop/IT/taminot) alohida belgilangan. Barcha so'm hisoblari taxminiy kurs 1 $ ≈ 13 000 so'm.

## 0. Faktlar bazasi (2025–2026, manba bilan)

| # | Fakt | Qiymat | Manba |
|---|------|--------|-------|
| F1 | O'TY yuk tashish 2025 | 107,9 mln t (+5,1%) | Statistika qo'mitasi / everyday.uz, 14.02.2026 |
| F2 | Xalqaro konteyner 2025 | 355 752 TEU (+21%) | cac.wtmreport.com |
| F3 | Tranzit 2025 | 15,3 mln t (4 yilda ×1,5) | spot.uz, 01.07.2026 |
| F4 | Logistika markazlari | 27 ta xalqaro darajali, quvvat 27,2 mln t; 24 tasi ESKATO «quruq port» statusi (14.11.2025), shundan Toshkent sh. 7, Toshkent vil. 4 (Angren LC ham) | spot.uz 14.11.2025; 01.07.2026 |
| F5 | O'ztemiryo'lkonteyner terminallari | 21 stansiya (Chuqursoy, Toshkent-tovar, Sergeli, Ohangaron, To'ytepa, Jizzax, Buxoro, Qarshi, Termiz, Nukus, Urganch, Qo'qon, Andijon, Marg'ilon, Raustan…) | railway.uz |
| F6 | Ekspeditorlar reestri | 74 tashkilot (O'TY ro'yxati) | railway.uz/14511 |
| F7 | Avtotashuvchilar | 2 368 xalqaro tashuvchi, 25 538 mashina | gazeta.uz 15.01.2025 |
| F8 | Shahobcha yo'llar (lokal) | «Шахобча йўллар.xlsx» — 1 393 qator (MTU, egasi, stansiya ESR, uzunlik, sig'im, yo'l soni); «инфо по под путям.xlsx» — 482 qator; VagonFlow `import-sidings-179.ts` = 179-telegramma (11.08.2026) reyestri | lokal fayl |
| F9 | Stansiyalar | railmap-esr-import.json — 214 ESR-kodli stansiya; ЕСР faylida O'zbekiston varag'i 243 qator | lokal fayl |
| F10 | Mijozlar | 18 428 reestr, 18 338 STIR (99,5%), 7 056 stansiyaga biriktirilgan, Toshkent 6 300+ | kontekst §B.07 |
| F11 | Tarif siyosati | 01.12.2024 mahalliy vagon +30%; 15.01.2025 koeffitsientlar 0,774–0,921 («bozor tamoyili»); 01.07.2026 shartnomaviy narxlar va shahobchaga vagon berish-olish +5% | spot.uz 13.11.2024, apk-inform, spot.uz 12.06.2026 |
| F12 | Transport xizmatlari | yan–okt 2025: 150,8 trln so'm (+13,4%), Toshkent 33,7 trln | yuz.uz / stat.uz |
| F13 | O'TY raqamlashtirish | EBRD €38,4 mln kredit — dispetcherlik, rejalashtirish, kiberxavfsizlik (2026); e-nakl.railway.uz «yagona oyna» ↔ Soliq ETTN integratsiyasi | ebrd.com 2026; buxgalter.uz |
| F14 | E-logistika | 13.02.2025 ishga tushgan, e-logistika.mintrans.uz, Mintrans; jo'natuvchi–tashuvchi–qabul qiluvchi (avto fokus) | yuz.uz, ati.su news 03.03.2026 |
| F15 | To'lov komissiyasi | Payme/Click/Uzum merchant 0,8–2%; 01.07.2025 dan internet-ekvayring majburiy | vc.ru, azma.uz |
| F16 | BNPL | MB: 3–12 oy ustama 0–68%, o'rtacha yillik ekvivalent 66,5%; MB tartibga solishni boshlamoqda | gazeta.uz 02.05.2025, spot.uz |
| F17 | SMS narxi | Eskiz 95 so'm; Playmobile (5800) 168,4 so'm (01.03.2025) | eskiz.uz, playmobile.uz |

## 1. Raqobat va analoglar

| Platforma | Nima qiladi | Monetizatsiya | Kuchli | Zaif | YukSaroy'dan farqi |
|-----------|-------------|---------------|--------|------|--------------------|
| **E-logistika (Mintrans, 13.02.2025)** | Yuk jo'natuvchi–tashuvchi–qabul qiluvchi raqamli platforma, davlat tashabbusi | Davlat byudjeti; tarif e'lon qilinmagan | Rasmiy status, ETTN/Soliq bilan yaqinlik, avto-tashuvchilar reestri | Avto-yo'naltirilgan; terminal/shahobcha/vagon obyektlari yo'q; sayt kontenti bo'sh (03.09.2026 fetch), aktivlashuv sust | YukSaroy — temir yo'l «rail-side» obyektlari (yuk saroyi, shahobcha, vagon, teplovoz); E-logistika bilan raqobat emas — integratsiya (ETTN/avto tashuvchi reestri) |
| **O'TY raqamli tashabbuslari 2025–26** (e-nakl.railway.uz «yagona oyna», ETTN, EBRD €38,4 mln) | Hujjat (nakladnoy) elektronlashtirish, dispetcherlik/rejalashtirish ichki tizimlari | Ichki xarajat, xizmat haqi | Ma'lumot egasi (ASOUP, dislokatsiya), majburiy kanal | Ichki foydalanuvchiga mo'ljallangan; marketpleys/terminal savdosi, tayms-slot, rating yo'q; UX «idora» darajasida | YukSaroy O'TY ustida «front» qatlam: mijoz-tomon UX + terminal/shahobcha savdosi; API integratsiya F2 |
| **ATI.SU** (RF/MDH) | Avto-yuk birjasi: yuklar, transport, tender, «Svetofor» tekshiruv, GPS, EDO; 10 mln MAU; 2 mlrd rub tushum (+24%) | Birja bepul; litsenziya 30–360 kun; «Ploshadkalar»da yuk joylash 13–50 rub/yuk (hajmga qarab), tashuvchi bepul, ekspeditorga −30% | Likvidlik, ishonch reytingi, tender | Faqat avto; O'zbekistonda temir yo'l ob'ektlari yo'q; rubl narx | YukSaroy avto-birjani F2 da «oxirgi milya» sifatida qo'shadi, asosiy ob'ekt — terminal xizmati |
| **RZD ETP «Грузовые перевозки»** («Цифровая логистика») | Vagon, terminal-ombor, «birinchi/oxirgi milya», spot bitimlar; 19 ta RZD tizimi bilan integratsiya, barcha yuk terminallarida; 8 000+ foydalanuvchi (2022), 144 provayder (2023), 15 davlat mijozi | Xizmat haqi + komissiya (davlat monopolisti «bir darcha») | Isbotlangan model: terminal-ombor xizmatini onlayn sotish 2020 aprelda ×3,5 o'sgan | Faqat RZD sho'ba jamiyatlari xizmati; xususiy shahobcha/aktiv bozori yo'q; UX og'ir | YukSaroy — xususiy + davlat terminallari aralash marketpleys; aktivlar bozori; eng yaqin «shablon» |
| **KTZ / KTZ Express (QZ)** | Multimodal ekspeditor + raqamli kabinet: 2025 dan norezidentlar masofadan ERI olib ulanadi; Tez Customs (2024) | Ekspeditorlik marjasi, xizmat haqi | Davlat ekspeditori — hajm, chegara-bojxona | Marketpleys emas — o'zi sotadi (raqamli ekspeditor modeli) | YukSaroy neytral maydoncha; KTZ Express F4 «xalqaro portlar» hamkori |
| **Middle Corridor platformalari** (TITR 2026 reja; Ikarus Way) | TITR bo'ylab elektron hujjat + bojxona ma'lumot almashuvi; Ikarus Way — tashuvchi-jo'natuvchi matching, GPS, escrow 48 soat | Ikarus: tashuvchi 0%, jo'natuvchi 2% bitimdan | Escrow + POD modeli, tranzit fokus | Tranzit avto/konteyner; O'zbekiston ichki yuk saroylari yo'q | YukSaroy ichki bozor; escrow modelini ko'chiradi; TITR bilan F4 |
| **China Railway 95306** | Milliy multimodal platforma: yuk, birja (13 tovar), «One Document» — 90 000 TEU (2025–26), tsikl −5…10 kun | Davlat + savdo komissiyasi | Ma'lumot to'liqligi, port/bojxona bilan ulanish | O'z bozori uchun; ochiq emas | Uzoq muddat: Lianyungang/Kashg'ar orqali yo'nalishlar F4 |
| **Uzum / Yandex (UZ)** | B2C e-com logistika, Yandex Delivery «Cargo» shahar ichi avto | Etkazib berish haqi, seller komissiyasi | Brend, to'lov (Uzum Bank, Nasiya), fulfillment | B2B temir yo'l yo'q, Uzum Nasiya B2C | Uzum Bank/Nasiya — potentsial faktoring/rassrochka hamkori, raqobatchi emas |
| **Kaspi (QZ)** | E-com + to'lov + 6 000 postomat; B2B yuk platformasi yo'q | Super-app | Ekotizim | Yuk saroyi yo'nalishi umuman yo'q | Analog sifatida «super-app» UX-benchmark, xolos |

**Xulosa:** temir yo'l yuk saroyi + shahobcha + vagon/teplovoz aktivlarini bitta katalogga jamlagan platforma O'zbekistonda (va MDHda RZD ETP dan tashqari) yo'q. Eng xavfli raqib — Mintrans E-logistika rasmiy status bilan «temir yo'l moduli» qo'shsa; javob: birinchi bo'lib terminallar bilan shartnoma (taklif tomoni) va O'TY ma'lumotiga yaqinlik.

## 2. Bozor hajmi: TAM / SAM / SOM

**Nima uchun tonna-operatsiya:** yuk saroyi pul topadigan birlik — yuklash yoki tushirish operatsiyasi, tashish tarifi emas. Har tonna kamida 1 yuklash + 1 tushirish o'tadi.

Formulalar va qiymatlar:

```
T_op  = 107,9 mln t × 2 operatsiya               = 215,8 mln t-op/yil        (F1)
P_avg = 17 000 so'm/t (demo tariflari 16 000–18 500)                              (kontekst §C)
K_add = 1,30 (SVX, tarozi, saqlash, hujjat, oxirgi milya — demo EXTRA ro'yxati)

TAM = T_op × P_avg × K_add = 215,8 mln × 17 000 × 1,3 ≈ 4,77 trln so'm/yil (~$367 mln)

SAM = TAM × S_open, S_open = 25%  — umumiy foydalanish terminallari + ijaraga qo'yilgan
      shahobchalar orqali o'tuvchi ulush (qolgan 75% — kon/zavodning o'z shahobchasi, ko'mir/ruda/sement,
      mexanizatsiyalashgan, marketpleysga chiqmaydi)
SAM ≈ 1,19 trln so'm/yil (~$92 mln)

SOM (3 yil) = SAM × G_geo × A_adopt
   G_geo   = 45% (Toshkent tuguni + Urganch, Buxoro-2, Qarshi, Nukus, Denov — F10 stansiya xaritasi)
   A_adopt = 27% (onlayn band qilingan slotlar ulushi, 3-yil oxiri)
SOM ≈ 1,19 × 0,45 × 0,27 ≈ 145 mlrd so'm GMV/yil  → take-rate 3% = 4,3 mlrd so'm + SaaS
```

Tekshiruv (bottom-up, konsepsiya §04): 20 terminal × 150 bitim × 2,5 mln so'm = 7,5 mlrd/oy = 90 mlrd/yil — SOM ning 62%; ikki hisob bir tartibda.

Mijoz-tomon tekshiruv: 18 428 reestr → faol (6 oyda hajmi bor) taxminan 30% = 5 500 → 3-yilda 27% aktivatsiya = 1 500 to'lovchi mijoz × 2 bitim/oy × 2,5 mln = 90 mlrd so'm/yil GMV. Mos.

Qo'shimcha bozorlar (TAM ga kirmaydi, alohida): aktivlar bozori (1 393 shahobcha reyestri — ijara/sotuv e'lonlari), vagon ijarasi (2,1–2,6 mln so'm/oy/vagon), teplovoz smena 12–14 mln so'm, hujjat xizmati (90–320 ming so'm/hujjat), to'lov agenti/rassrochka.

## 3. Pozitsiya va 3 ustunlik

Pozitsiya: **«Temir yo'l yuki uchun terminal, shahobcha va vagon — 3 daqiqada topiladi, onlayn band qilinadi»**. Marketpleys (ATI modeli), raqamli ekspeditor emas — chunki ekspeditor bo'lsak 74 ekspeditor (F6) raqibga aylanadi, marketpleys bo'lsak ular mijoz/taklif tomonidir.

| Ustunlik | Dalil | Raqib nusxalashi qiyinligi |
|----------|-------|----------------------------|
| **1. Ma'lumot ustunligi (rail-side data)** | 1 393 shahobcha + 214 ESR stansiya + 18 428 STIR-li mijoz + VagonFlow `Siding/StationTrack/Request` modellari allaqachon bor | E-logistika/ATI da bu ob'ektlar yo'q; yig'ish 12+ oy va MTU ishonchi |
| **2. Operatsion qatlam — «qo'ng'iroq va qog'oz»ni almashtirish** | Stansiya boshlig'iga avtomatik xat (vagon ro'yxati, davr, shahobcha egasi roziligi, ERI), GU-12/GU-29 stol uslug, tayms-slot, 30 daq SLA | UX + soha regulyatsiyasini bilish; RZD ETP shu yo'ldan 2019–2020 da o'tgan (terminal-ombor onlayn ×3,5) |
| **3. Ikki tomonlama moliya** | Rassrochka +4/8/14% (BNPL bozori o'rtacha 66,5% yillik — F16), escrow, tarif balansini to'ldirish | Bank hamkori + O'TY ELS ga to'lov agenti maqomi — litsenziya/shartnoma to'sig'i |

Alternativa (rad etildi): «vertikal SaaS faqat terminalga» — 21+27 terminal bilan bozor tor (≈50 × 1,5 mln = 75 mln so'm/oy shift), likvidlik yo'q. Marketpleys + SaaS gibrid tanlandi.

## 4. GTM

### 4.1 Pilot: Toshkent tuguni (F1 bosqich, 3–4 oy)

| Terminal / obyekt | Nega | Taklif |
|-------------------|------|--------|
| Toshkent-tovar | Eng katta yuk saroyi, 24/7, SVX | Ekran-1 vitrina, 0% komissiya 6 oy |
| Chuqursoy | O'ztemiryo'lkonteyner (F5), konteyner | Tayms-slot pilot |
| Sergeli | 179 mijoz biriktirilgan (F10), xususiy teplovoz e'lonlari | Aktivlar bozori pilot |
| Angren LC (quruq port, ESKATO) + Ohangaron | Tranzit/konteyner, 100 mln $ hab | Import yo'nalishi: SVX katalogi |
| To'ytepa | O'ztemiryo'lkonteyner | Zaxira |

Muvaffaqiyat mezoni (F1 oxiri): 5 terminal paspor­ti to'liq, 300 onlayn bitim/oy, slotlarning 20% onlayn, terminal tasdiqlash SLA ≤ 30 daq 80% holatda.

### 4.2 Taklif tomonini to'ldirish (tovuq-tuxum yechimi)

1. **«Katalog avval»:** 21 O'ztemiryo'lkonteyner + 24 quruq port + 27 LC = ~50 ob'ekt paspor­tini jamoa o'zi to'ldiradi (1 sahifa anketa, 2 hafta, 2 kishi). Terminal roziligisiz ham ochiq ma'lumot (manzil, ish vaqti) chiqadi — «claim your terminal» tugmasi.
2. **Shahobcha reyestri import:** 1 393 qator → «Aktivlar bozori» kartasi (egasi, uzunlik, sig'im). Egasi STIR orqali kirib «ijaraga beraman/bermayman» belgilaydi.
3. **0% komissiya 6 oy + SaaS bepul** pilot terminallarga; evaziga slot jadvali va tariflarini ochiq e'lon qilish majburiyati.
4. **Xususiy teplovoz/kran egalari** (Sergeli, Chuqursoy) — birinchi 50 e'lon bepul, VIP 300 ming so'm/oy.

### 4.3 18 428 mijoz bazasini aktivatsiya to'lqinlari

| To'lqin | Segment | Hajm | Kanal | Kutilgan konversiya | Xarajat |
|---------|---------|------|-------|---------------------|---------|
| W0 (hafta 1–2) | VagonFlow faol mijozlari (ClientBotSession, telefon bor) | ~800 | Telegram bot push (bepul) | 35% kirish, 12% bitim | ~0 |
| W1 (oy 1) | Toshkent tuguni, faol 6 oy, STIR bor | 1 000 | SMS (Eskiz 95 so'm) ×2 + call-center | 20% kirish, 6% bitim | 1 000×190 + 200 qo'ng'iroq×5 000 = 1,2 mln so'm |
| W2 (oy 2–3) | Toshkent vil. qolgan 5 300 | 5 300 | SMS + «yagona darcha» login xabari + MTU yig'ilishi | 12% / 4% | ~2,5 mln so'm |
| W3 (oy 4–8) | Urganch 499, Buxoro-2 431, Qarshi 238, Nukus 215, Denov 192 | 1 575 | MTU + stansiya DSP orqali, offlayn seminar | 15% / 5% | ~6 mln so'm (safar) |
| W4 (oy 9+) | Qolgan 9 700 + telefon yo'q | 9 700 | O'TY «yagona oyna» banner, ekspeditorlar (74) referal | 8% / 2% | referal bonus |

Telefon raqami reestrda 0 (F10) — W0/W1 da telefon VagonFlow `Client.phone` va DSP jurnalidan olinadi; qolgani «yagona oyna» login orqali.

### 4.4 Kanallar

- **Telegram** — VagonFlow botining mavjud auditoriyasi; YukSaroy mini-app (buyurtma/status) — kichik mijozlar uchun asosiy kanal.
- **O'TY / Yuk boshqarmasi** — rasmiy homiy (konsepsiya §06); e-nakl «yagona oyna»da havola; 3-ilova yagona namunaviy ariza shakli allaqachon bor.
- **MTU (7 ta)** — oylik yig'ilishda 20 daqiqalik demo; stansiya boshlig'iga avtomatik xat funksiyasi — DSP uchun qadriyat (qog'oz kamayadi).
- **Ekspeditorlar (74)** — «agent» tarif: mijoz olib kelsa komissiyaning 30% i.

### 4.5 Sotuv skripti (terminal boshlig'i, 4 daqiqa)

1. Ochilish: «Sizning terminalingiz Sergelida 179 biriktirilgan mijozdan qanchasi o'tgan oyda keldi? Biz 18 428 mijoz reestrini ochiq ko'ramiz — Toshkentda 6 300 tasi».
2. Og'riq: «Navbat goh tiqiladi, goh bo'sh — qog'oz jurnal buni ko'rsatmaydi. Slot jadvali kabinetda 2 soatlik oynalar bilan turadi».
3. Taklif: «6 oy 0% komissiya, kabinet bepul. Sizdan — paspor­t anketasi (1 sahifa) va tariflar».
4. Isbot: RZD terminal-ombor xizmati onlayn 2020 da ×3,5 o'sdi; Ikarus Way escrow 48 soatda to'laydi.
5. Yopish: «Ertaga 11:00 da 30 daqiqalik onboarding — dispetcheringiz slotlarni ochib qo'yadi».

### 4.6 Hamkorlar

| Hamkor | Rol | Model |
|--------|-----|-------|
| Payme / Click / Uzum Pay | Onlayn to'lov, 0,8–2% (F15) | Platforma marjasi ichida |
| Bank (Hamkorbank / TBC / Uzum Bank / Ipoteka) | Rassrochka va faktoring limiti; escrow hisob | Agentlik 1–2% + foiz ulushi |
| Sug'urta (Gross, Apex, Uzbekinvest) | Yuk sug'urtasi bir tugmada | Agentlik 10–15% mukofotdan |
| E-IMZO / DSA | ERI imzo (stansiyaga xat, oferta) | Integratsiya |
| Eskiz / Playmobile | SMS 95–168 so'm | Xarajat |
| Mintrans E-logistika | ETTN, avto-tashuvchi reestri | API integratsiya (raqobat emas) |

## 5. Narx siyosati benchmark

| Oqim | Benchmark | YukSaroy taklifi | Nega |
|------|-----------|------------------|------|
| Bitim komissiyasi | Ikarus Way 2% (jo'natuvchi), Uber Freight enterprise < 5%, ATI «ploshadka» 13–50 rub/yuk (~1 700–6 500 so'm) | Pilot 0% → 2% (F2) → 3% (F3); terminal to'laydi, mijoz ko'rmaydi | Mijoz tomonida 0 ishqalanish; 2,5 mln so'mlik bitimda 75 ming — terminal uchun mijoz jalb narxidan arzon |
| SaaS terminal | ATI litsenziya oylik; konsepsiya 1,5 mln so'm | Start 0 so'm (5 slot/kun, 1 foydalanuvchi) · Pro 1,5 mln so'm/oy (cheksiz slot, CRM, hisobot) · Enterprise 4 mln so'm/oy (API, filiallar, SLA) | Freemium bo'lmasa taklif tomoni kelmaydi |
| Tayms-slot to'lovi | eModal — terminalga qarab, e'lon qilinmaydi | 50 000 so'm/slot, no-show da qaytmaydi | No-show ni kamaytirish; kichik summa |
| E'lon / premium | ATI VIP, Uzum promo | Oddiy e'lon bepul (30 kun), VIP 300 000 so'm/oy, katalogda top-3 1 mln so'm/oy | Aktivlar bozori likvidligi avval |
| Hujjat (stol uslug) | Demo: GU-29 180k, SMGS 320k, GU-12 90k | Shu narxlar, paket «5 hujjat» −15% | Bozorda shaxsiy «dekларант» narxi shunga yaqin |
| Rassrochka | MB o'rtacha 66,5% yillik (F16); «klassik» 3–4 oy 0% sotuvchi hisobidan | 3 oy +4% / 6 oy +8% / 12 oy +14% (yillik ≈ 14–16%) | Bozordan 4× arzon — bank faktoring stavkasiga yaqin; MB regulyatsiyasiga tayyor |
| To'lov agenti (ELS) | Payme merchant 0,8–2% | 0,5% (min 20 000 so'm) | Hajm katta, marja to'lov tizimi ustiga qo'yiladi |

Narxlar so'mda, yiliga F11 tarif indeksatsiyasi (+5% 2026) bilan qayta ko'riladi.

## 6. Investor / hamkor uchun 1 sahifa (uz)

**YukSaroy — O'zbekiston temir yo'l yuk saroylari, shahobcha yo'llari va vagon aktivlarining yagona marketpleysi.**

- **Muammo:** 107,9 mln t yuk (2025) 50+ terminal va 1 393 shahobcha orqali «qo'ng'iroq va qog'oz» bilan o'tadi; jo'natuvchi terminal narxi va bo'sh slotini ko'rmaydi, terminal bo'sh quvvatini sota olmaydi.
- **Yechim:** katalog + narx kalkulyatori + tayms-slot + elektron hujjat (stansiya boshlig'iga avtomatik xat, GU-12/GU-29) + to'lov/rassrochka + aktivlar bozori. VagonFlow (vagon talabnomasi tizimi, ishlab turibdi) bilan bitta oqim.
- **Bozor:** TAM 4,8 trln so'm/yil, SAM 1,2 trln, SOM (3 yil) 145 mlrd so'm GMV.
- **Model:** komissiya 3% + SaaS (0/1,5/4 mln so'm) + slot/e'lon/hujjat + moliya agentligi. 3-yil maqsad: 4,3 mlrd komissiya + 0,9 mlrd SaaS + 1,5 mlrd qo'shimcha ≈ 6,7 mlrd so'm/yil tushum.
- **Nega biz:** soha ichidan jamoa; 18 428 mijoz reestri (99,5% STIR), 1 393 shahobcha, 214 stansiya ma'lumoti allaqachon qo'lda; VagonFlow production da.
- **Raqobat:** E-logistika (avto, davlat), ATI (avto), RZD ETP (RF ichida). Temir yo'l terminal nishasi bo'sh.
- **So'rov:** F0–F2 uchun 14 oy, 3,2 mlrd so'm (jamoa 6 kishi, marketing 250 mln, escrow/bank integratsiya 300 mln, zaxira 15%). Rasmiy homiy — O'TY Yuk boshqarmasi darajasida memorandum.
- **KPI 12 oy:** 20 terminal, 3 000 bitim/oy, slotlarning 30% onlayn, tasdiqlash SLA 30 daq.

## 7. Unit-ekonomika (taxminiy model, so'm)

Faraz: o'rtacha bitim 2,5 mln so'm; take-rate 3%; to'lov tizimi 1,2%; faol mijoz 2 bitim/oy; oylik churn 4% (lifetime 25 oy); terminal churn 2,5%/oy (40 oy).

| Ko'rsatkich | Yuk jo'natuvchi (demand) | Terminal (supply) | Izoh |
|-------------|--------------------------|-------------------|------|
| CAC (aktivatsiya) | 150 000 | 5 000 000 | Mijoz: SMS 190 + call 5 000 / 6% konversiya + onboarding; terminal: 2 tashrif + 1 oy 0% |
| CAC (to'lovchi) | 600 000 | 5 000 000 | Kirganlarning 25% i bitim qiladi |
| ARPU / oy | 2 × 2,5 mln × 3% = 150 000 | SaaS 1,5 mln + slot 50k × 60 = 3 mln + komissiya ulushi | Terminal komissiyani to'laydi, lekin unga GMV keladi |
| Gross margin / oy | 150 000 − to'lov 1,2%×5 mln (60 000) − SMS/support 10 000 = 80 000 | 3 mln − support 300 000 = 2,7 mln | |
| LTV (gross) | 80 000 × 25 = 2,0 mln | 2,7 mln × 40 = 108 mln | |
| LTV / CAC | 3,3 | 21,6 | Demand tomonda > 3 chegarasi; supply tomon juda foydali — shuning uchun 0% pilot arzon |
| Payback | 7,5 oy | 1,9 oy | |

Sezgirlik: take-rate 2% → mijoz LTV/CAC 1,9 (chegarada) — shuning uchun 2% faqat F2 da, 3% F3 dan. Bitim 2 → 3/oy bo'lsa LTV/CAC 5,0. To'lov komissiyasi 1,2% → 0,8% (hajm kelishuvi) bo'lsa gross margin 100 000.

Take-rate skeyl jadvali (SOM 145 mlrd GMV):

| Take-rate | Komissiya tushumi/yil | SaaS (30 terminal × Pro) | Qo'shimcha (slot, e'lon, hujjat, agentlik) | Jami |
|-----------|-----------------------|--------------------------|--------------------------------------------|------|
| 2% | 2,9 mlrd | 0,54 mlrd | 1,2 mlrd | 4,6 mlrd |
| 3% | 4,35 mlrd | 0,54 mlrd | 1,5 mlrd | 6,4 mlrd |
| 4% | 5,8 mlrd | 0,54 mlrd | 1,5 mlrd | 7,8 mlrd (churn xavfi ↑) |

## 8. Xavflar (bozor)

| Xavf | Ehtimol | Javob |
|------|---------|-------|
| Mintrans E-logistika «temir yo'l» modulini e'lon qiladi | O'rta | 6 oy ichida 20 terminal shartnomasi; E-logistika bilan API hamkorlik taklifi |
| O'TY o'zi «yagona oyna»da terminal savdosini ochadi (EBRD loyihasi) | Past–o'rta (EBRD fokus dispetcherlik) | Rasmiy homiy memorandumi; YukSaroy = O'TY uchun front, raqib emas |
| BNPL regulyatsiyasi (MB) rassrochkani cheklaydi | O'rta | Bank hamkori orqali, o'z balansidan emas; +4/8/14% MB chegarasidan past |
| Terminal slot ochishni istamaydi (korrupsion manfaat) | Yuqori | Rating + O'TY KPI; «claim» bo'lmagan terminal ham katalogda ko'rinadi |

## Manbalar

- everyday.uz, 14.02.2026 — 107,9 mln t (+5,1%): https://everyday.uz/business/18601-post.html
- cac.wtmreport.com — 355 752 TEU 2025
- spot.uz, 01.07.2026 — 27 LC, 27,2 mln t, tranzit 15,3 mln t: https://www.spot.uz/ru/2026/07/01/transit-issues
- spot.uz, 14.11.2025 — 24 quruq port ro'yxati: https://www.spot.uz/ru/2025/11/14/dry-ports
- railway.uz — O'ztemiryo'lkonteyner terminallari: https://railway.uz/ru/uslugi/konteynernye_perevozki/109/ ; ekspeditorlar ro'yxati (74): https://railway.uz/ru/uslugi/gruzovye_perevozki/14511/
- gazeta.uz, 15.01.2025 — 2 368 tashuvchi, 25 538 mashina
- spot.uz 13.11.2024 (+30%), apk-inform (15.01.2025 koeffitsientlar), spot.uz 12.06.2026 (+5%)
- yuz.uz / stat.uz — 150,8 trln so'm transport xizmatlari
- ebrd.com, 2026 — €38,4 mln O'TY raqamli transformatsiya
- buxgalter.uz — ETTN ↔ e-nakl.railway.uz integratsiyasi
- yuz.uz 13.02.2025; news.ati.su 03.03.2026 — E-logistika
- ati.su/prices, help.ati.su/platforms-price — ATI narxlari; tadviser — 2 mlrd rub tushum
- logirus.ru (2020) — RZD terminal-ombor onlayn ×3,5; tadviser/rzd — 8 000+ foydalanuvchi, 144 provayder, 19 tizim, 15 davlat
- ktze.kz — 2025 norezidentlar; timesca.com — TITR 2026 reja; ikarusway.com/pricing — 0% / 2%, escrow 48 soat
- railwaypro.com, baike.baidu — 95306
- vc.ru, azma.uz — Payme/Click 0,8–2%, ekvayring majburiyati 01.07.2025
- gazeta.uz 02.05.2025, spot.uz — BNPL 66,5%
- eskiz.uz, playmobile.uz — SMS narxi
- sec.gov Uber ARS FY2025, ttnews — take-rate < 5%
- Lokal: C:/Users/user/Desktop/IT/taminot/Шахобча йўллар.xlsx (1 393 qator), инфо по под путям.xlsx (482), railmap-esr-import.json (214), ЕСР с новыми станциями.xlsx, taminot-master/prisma/import-sidings-179.ts
