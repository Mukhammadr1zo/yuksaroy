# YukSaroy — Mahsulot (PM) tahlili · lens: pm

Rol: Senior Product Manager (B2B marketpleys, logistika). Manba: konsepsiya (modul 1–6, kengaytirilgan ekotizim, mukammallik yo'li), Ish standarti v1.0 (8 jarayon + SLA jadvali), interaktiv demo (NAVS/MROLES/funksiyalar), VagonFlow Prisma sxemasi (Siding, WagonMemo/NaryadStatus, Request), foydalanuvchining oxirgi talabi (stansiya boshlig'iga avtomatik xat).

## 0. Bozor konteksti — tekshirilgan faktlar (2026)

| Fakt | Ahamiyati YukSaroy uchun | Manba |
|---|---|---|
| 2025: temir yo'lda 106,4 mln t yuk, tranzit 12 mln t+ | TAM katta — har tonna yuk saroyi/shahobcha orqali o'tadi | [anhor.uz](https://anhor.uz/uz/news/transport-2025-sarhisob-kr/) |
| QZ–UZ t/y yuk oqimi 2025: 32,3 mln t (+16%) | Import yo'nalish (SVX, tushirish) o'smoqda | [Astana Times](https://astanatimes.com/2026/02/kazakhstan-uzbekistan-target-higher-railway-freight-volumes/) |
| EBRD 2026-06: O'TY raqamlashtirishga €38,4 mln (dispetcherlik, rejalashtirish) | O'TY API oynasi 2027–28 da; F1–F2 API'ga tayanmaydi | [EBRD](https://www.ebrd.com/home/news-and-events/news/2026/ebrd-supports-digital-transformation-of-uzbekistan-railways.html) |
| O'TY «Yagona darcha» (e-nakl.railway.uz) bor: e-nakladnoy, GU-12, to'lov, tarif kalkulyatori, vagon izlash | GU-12/e-nakladnoy QAYTA QURILMAYDI; pozitsiya — terminal tomonidagi xizmatlar (slot, kran, ombor, shahobcha, avto, mutaxassis) | [e-nakl](https://e-nakl.railway.uz/Home/About), [railway.uz](https://railway.uz/uz/e-okno/) |
| RJD ETP GP: barcha yuk terminallarida, 1 mln+ vagon-jo'natma, 5000 foydalanuvchi | Terminal xizmatini onlayn sotish — isbotlangan | [TAdviser](https://www.tadviser.ru/index.php/Продукт:Электронная_торговая_площадка_Грузовые_перевозки_(ЭТП_ГП)) |
| eModal PreGate: gate-appointment + «yuk tayyormi» tekshiruvi | M2 slot modeli uchun namuna | [BusinessWire](https://www.businesswire.com/news/home/20191015005189/en/Everport-Terminal-Services-Tacoma-Goes-Live-With-eModal-PreGate-Appointment-Solution-to-Drive-Cargo-Velocity-and-Improve-Gate-Efficiency) |
| Payme/Click/Uzum komissiyasi ≈0,8–2% | 3% take-rate'ning 1/3–2/3 ini yeydi → B2B da invoice asosiy | [onedev.uz](https://onedev.uz/en/blog/how-to-accept-online-payments-in-uzbekistan-click-payme-uzum-and-cards) |
| E-IMZO: sayt QR chiqaradi, mobil ilova imzolaydi | ERI F2 da QR-oqim | [E-IMZO](https://play.google.com/store/apps/details?id=uz.yt.idcard.eimzo&hl=en_US) |

Xulosa: konsepsiyadagi «TY kod + GU-12 + e-hujjat» qatlami davlatda bor; davlat portali bilan raqobat rad etiladi — himoyalanadigan joy terminal/shahobcha/aktiv tomonida.

## 1. Personalar (11 rol)

| # | Persona | JTBD («... bo'lganda, ... xohlayman, shunda ...») | Asosiy og'riq | Muvaffaqiyat mezoni |
|---|---|---|---|---|
| P1 | **Yuk jo'natuvchi / logist** — Dilshod, «Xorazm Agro Eksport» MChJ, Urganch (reestrda 499 mijoz) | Vagon berilganda terminal/kran/slotni 5 daqiqada topib, narxni oldindan bilib band qilmoqchi | 6–10 qo'ng'iroq, «tanish» orqali navbat, narx og'zaki, demurraj kimniki — noaniq | Buyurtma ≤5 daq; tasdiq ≤30 daq; demurraj −40% (6 oy) |
| P2 | **Terminal operatori** — Sherzod, Sergeli, smena boshlig'i | Ertangi 6 slotni oldindan to'ldirib, kran/brigadani rejalashtirmoqchi | Qog'oz jurnal, «kim qachon keladi» noma'lum | Slot to'ldirilishi ≥70%; no-show ≤10%; tasdiq SLA ≥90% |
| P3 | **Ekspeditor** — «Sogdiana Trans» menejeri | Butun zanjirni (vagon → terminal → avto) bitta kabinetdan boshqarmoqchi | 5 Excel, 3 Telegram guruh; javobgar, lekin ma'lumot yo'q | ≥15 buyurtma/oy; ochiq buyurtmaga javob ≤2 soat |
| P4 | **Deklarant** — mustaqil bojxona vakili | SVX ga kelayotgan vagonni oldindan ko'rib deklaratsiyani tayyorlamoqchi | Vagon kelgach xabar beriladi, SVX to'lovi o'sadi | ETA 24 soat oldin; deklaratsiya ≤1 kun |
| P5 | **Avtotashuvchi / haydovchi** — Bekzod, 20 t tentli fura, Angren | Yukni aniq soatda olib, qaytishda bo'sh yurmaslikni xohlaydi | Darvozada 3–4 soat kutish, porojnyak | Kutish ≤40 daq; qaytish yuklanganligi ≥30% |
| P6 | **Vagon egasi** — «TemirTrans Aktiv» MChJ, 15 poluvagon | Bo'sh vagonlarni tez ijaraga bermoqchi | Talab noma'lum, e'lon OLX/Telegram'da | Bo'sh kunlar −25%; bitim ≤5 kun |
| P7 | **Shahobcha yo'l egasi** — «Biokimyo» AJ, 450 m, 28 vagon | Bo'sh sig'imni berib, «qarshi emasman» ni bir tugmada bermoqchi | Har mijozga alohida xat, muhr, stansiyaga borish | Bandlik ≥60%; rozilik ≤10 daq |
| P8 | **Stansiya boshlig'i (DS) / DSP** — Sergeli | So'rovlarni raqamlangan, tekshiriladigan ko'rinishda olib, DSP'ga naryad bermoqchi | Qog'oz xat, vagon raqamlari qo'lda, davr nazorati yo'q | Ko'rib chiqish ≤4 ish soati; naryad avto VagonFlow'ga |
| P9 | **Xususiy teplovoz xizmati** — TEM2, Sergeli, 24/7 | Kalendar bo'sh oynalarini sotmoqchi | Telefon buyurtma, soat hisobi nizoli | Band soat +30%; so'rov→tasdiq ≤1 soat |
| P10 | **Platforma operatori / admin** — moderatsiya, stol uslug, arbitraj | KYC, SLA buzilishi va nizolarni bitta navbatdan boshqarmoqchi | Rol boshiga alohida vosita — 3 kishi yetmaydi | KYC ≤1 kun; stol uslug ≤4 soat; nizo ≤3 kun |
| P11 | **O'TY boshqaruv** — Tashish boshqarmasi / MTU | Terminal yuklamasi va shahobcha bandligini haftalik ko'rmoqchi | Hisobot Excel bilan 2 haftada | Haftalik dashboard, 100% qamrov (F3) |

Nima uchun 11 ta (demoda 7): P8 va P11 oxirgi talab va «institutsional qarshilik» xatarini yopadi; P10 bo'lmasa «platforma arbitraji» egasiz. Alternativa — 4 rol (mijoz/terminal/xizmatchi/admin) — RBAC darajasida qilinadi, persona darajasida emas.

## 2. To'liq funksiya inventari

Belgilar: MoSCoW = M/S/C/W; faza F0–F4; murakkablik S/M/L/XL; bog'liqlik — qaysi ID dan keyin.

### Platforma yadro (K)

| ID | Funksiya | Rol | MoSCoW | Faza | Mur. | Bog'liq |
|---|---|---|---|---|---|---|
| K1 | Telefon + SMS-kod ro'yxat, STIR bo'yicha reestrdan avto-to'ldirish (18 428 mijoz importi) | barcha | M | F1 | M | — |
| K2 | Ko'p-rolli akkaunt + tashkilot (Org) va a'zolar | barcha | M | F1 | M | K1 |
| K3 | Elektron oferta qabul (SMS-tasdiq F1, ERI F2) | barcha | M | F1 | S | K1 |
| K4 | Bildirishnoma markazi: Telegram bot + FCM push + SMS (VagonFlow infra qayta ishlatiladi) | barcha | M | F1 | M | K1 |
| K5 | Audit jurnali (kim/qachon/nima) har holat o'zgarishida | admin | M | F1 | S | — |
| K6 | i18n uz/oz/ru (VagonFlow lug'at bazasi) | barcha | S | F1 | S | — |
| K7 | KYC/verifikatsiya navbati (STIR, guvohnoma, sertifikat) + «Tasdiqlangan» belgisi | admin | M | F2 | M | K1 |
| K8 | Admin panel: moderatsiya, SLA monitor, tariflar, kontent | admin | M | F1 | M | K5 |
| K9 | PWA (offline kesh, o'rnatiladigan) | barcha | S | F1 | M | — |
| K10 | Android/iOS native ilova (7 mobil profil) | barcha | S | F2 | XL | K9 |

### Modul 1 — Katalog + xarita (M1)

| ID | Funksiya | Rol | MoSCoW | Faza | Mur. | Bog'liq |
|---|---|---|---|---|---|---|
| M1.1 | Terminal pasporti (yo'llar, kran parki, ombor m², SVX, ish vaqti, tarif, foto) | terminal, admin | M | F1 | M | K2 |
| M1.2 | Katalog: viloyat/stansiya/xizmat filtri, reyting/narx saralash | mijoz | M | F1 | M | M1.1 |
| M1.3 | Interaktiv xarita (railmap ESR JSON, stansiya tugunlari, terminal pinlari) | mijoz | S | F1 | L | M1.1 |
| M1.4 | «Kelish stansiyasidan terminal tanlash» (vagon raqami → stansiya → yaqin terminallar) | mijoz | S | F2 | M | M4.2 |
| M1.5 | Real vaqt bandlik indikatori (load %, ochiq/yopiq) | mijoz | S | F2 | M | M2.6 |
| M1.6 | SVX (bojxona omborlari) katalogi | mijoz, deklarant | S | F2 | M | M1.1 |
| M1.7 | Ma'lumotnomalar: tarozilar reestri, yo'l bo'yi servislari | haydovchi | C | F3 | S | — |
| M1.8 | Xalqaro portlar katalogi (Oqtov, Poti, Bandar Abbos…) | ekspeditor | C | F4 | L | — |
| M1.9 | Premium joylashuv (top-3, «VIP» belgisi) | terminal | S | F2 | S | M1.2 |

### Modul 2 — Buyurtma va tayim-slot (M2)

| ID | Funksiya | Rol | MoSCoW | Faza | Mur. | Bog'liq |
|---|---|---|---|---|---|---|
| M2.1 | Buyurtma konstruktori (yo'nalish, operatsiya yuklash/tushirish/bo'sh vagon, yuk ETSNG, vazn, vagon №) | mijoz | M | F1 | L | M1.2 |
| M2.2 | Slot jadvali: terminal 2-soatlik oynalar, real vaqt band/bo'sh, optimistik qulflash | mijoz, terminal | M | F1 | L | M1.1 |
| M2.3 | Terminal kabineti: talabnoma qabul/rad (sabab bilan), 30 daq SLA taymeri | terminal | M | F1 | M | M2.1 |
| M2.4 | Auto-expire: 30 daq javobsiz → slot bo'shaydi, reyting −, mijozga alternativa | tizim | M | F1 | S | M2.3 |
| M2.5 | Qo'shimcha xizmatlar tanlovi (tarozi, saqlash, SVX, oxirgi milya) | mijoz | M | F1 | S | M2.1 |
| M2.6 | Terminal resurs rejasi (kran/brigada/maydon → slot) | terminal | S | F2 | L | M2.2 |
| M2.7 | Avto uchun gate-slot (fura darvoza navbati, eModal modeli) | haydovchi, terminal | S | F2 | L | M2.2 |
| M2.8 | Slot band qilish to'lovi (fiksatsiya, no-show jarimasi) | mijoz | S | F2 | M | M5.2 |
| M2.9 | Takroriy buyurtma / shablon | mijoz | C | F2 | S | M2.1 |
| M2.10 | Yuk tenderi (hajm e'loni → takliflar) | yirik mijoz, ekspeditor | C | F3 | L | E5.1 |

### Modul 3 — Narx kalkulyatori (M3)

| ID | Funksiya | Rol | MoSCoW | Faza | Mur. | Bog'liq |
|---|---|---|---|---|---|---|
| M3.1 | Ochiq formula: tarif × vazn + xizmatlar + platforma haqi (F1 da 0%) | mijoz | M | F1 | M | M1.1 |
| M3.2 | Terminal tarif boshqaruvi (yuk turi × operatsiya matritsasi, amal muddati) | terminal | M | F1 | M | M1.1 |
| M3.3 | Buyurtmasiz «tez hisob» landing'da | mehmon | S | F1 | S | M3.1 |
| M3.4 | AI «adolatli narx» indikatori (tarixiy bitimlar) | mijoz | C | F3 | L | M6.1 |

### Modul 4 — Kuzatuv va status (M4)

| ID | Funksiya | Rol | MoSCoW | Faza | Mur. | Bog'liq |
|---|---|---|---|---|---|---|
| M4.1 | Buyurtma holat mashinasi + push (SUBMITTED→CONFIRMED→ARRIVED→WEIGHED→LOADED→DONE) | barcha | M | F1 | M | M2.3 |
| M4.2 | VagonFlow integratsiya v1: Request/WagonMemo holatini webhook orqali ko'rsatish | mijoz | M | F1 | L | VagonFlow API |
| M4.3 | Demurraj taymeri (vagon kelgan/olib chiqilgan vaqt farqi, kim hisobidan) | mijoz, terminal | S | F2 | M | M4.2 |
| M4.4 | Vagon dislokatsiyasi (O'TY/ASOUP; F1 da qo'lda) | mijoz | S | F2 | XL | O'TY API |
| M4.5 | Fura GPS-trek + haydovchi ilovasi | haydovchi, mijoz | S | F2 | L | K10 |
| M4.6 | AI ETA va navbat bashorati | mijoz | C | F3 | L | M4.4 |
| M4.7 | 24 soat oldin «tushirish slotini band qiling» ogohlantirish | mijoz | S | F2 | M | M4.4 |

### Modul 5 — Hujjat va to'lov (M5)

| ID | Funksiya | Rol | MoSCoW | Faza | Mur. | Bog'liq |
|---|---|---|---|---|---|---|
| M5.1 | Dalolatnoma (akt) va hisob-faktura PDF avto-generatsiya | tizim | M | F1 | M | M4.1 |
| M5.2 | Onlayn to'lov: bank o'tkazmasi (invoice) + Payme/Click/Uzum | mijoz | M | F2 | L | M5.1 |
| M5.3 | Komissiya ajratish (split), terminalga hisob-kitob | tizim | M | F2 | M | M5.2 |
| M5.4 | Eskrou (muzlatish → bajarilgach yechish) | mijoz, xizmatchi | M | F2 | L | M5.2 |
| M5.5 | ERI imzo (E-IMZO QR oqimi) hujjatlarga | barcha | S | F2 | M | M5.1 |
| M5.6 | «Stol uslug»: GU-29, SMGS, GU-12, qayta jo'natish, VU to'plami — buyurtma, 4 soat SLA, PDF | mijoz, admin | S | F1 | M | K8 |
| M5.7 | TY kod olish arizasi (cheklist, holat, 3 ish kuni) — yarim-avto | mijoz, admin | S | F1 | M | K1 |
| M5.8 | Tarif balansi to'ldirish (ELS) — to'lov agenti | mijoz | S | F2 | L | M5.2 |
| M5.9 | Rassrochka 3/6/12 oy (+4/+8/+14%), limit, grafik | mijoz | C | F3 | L | M5.8, bank |
| M5.10 | 1C / buxgalteriya eksporti API | mijoz | C | F3 | M | M5.1 |
| M5.11 | Yuk sug'urtasi bir tugmada (agentlik) | mijoz | C | F3 | M | M5.2 |
| M5.12 | Faktoring («hozir jo'nat — 30 kunda to'la») | mijoz, terminal | C | F4 | XL | bank |

### Modul 6 — Reyting va analitika (M6)

| ID | Funksiya | Rol | MoSCoW | Faza | Mur. | Bog'liq |
|---|---|---|---|---|---|---|
| M6.1 | Buyurtmadan keyin 1–5 yulduz + izoh; reyting = o'rtacha + SLA jarimalari | mijoz | M | F1 | S | M4.1 |
| M6.2 | Terminal analitikasi (slot to'ldirish, tushum, no-show) | terminal | S | F2 | M | M2.2 |
| M6.3 | Boshqaruv dashboardi (tarmoq yuklamasi, oqimlar, reyting) | O'TY, admin | S | F2 | M | M6.1 |
| M6.4 | Mijoz oylik hisoboti (tashidi/tejadi/kechikdi) | mijoz | C | F3 | M | M6.2 |
| M6.5 | Ma'lumot-analitika API (banklar, yirik mijoz) | tashqi | C | F4 | L | M6.3 |
| M6.6 | Anti-frod: reyting «shishirish», sohta e'lon | admin | S | F2 | M | K7 |

### Ekotizim (E)

| ID | Funksiya | Rol | MoSCoW | Faza | Mur. | Bog'liq |
|---|---|---|---|---|---|---|
| E1.1 | Shahobcha yo'llar katalogi — VagonFlow `Siding` reestridan import (uzunlik, sig'im, egasi, shartnoma holati), xaritada | mijoz | M | F1 | M | M1.3 |
| E1.2 | **Stansiya boshlig'iga ruxsat xati konstruktori** (vagonlar jadvali, davr, egasining roziligi, PDF/DOCX, QR) | mijoz, shahobcha egasi | M | F1 | L | E1.1 |
| E1.3 | Shahobcha egasining «qarshi emasman» roziligi (kabinetda bir tugma, SMS/ERI) | shahobcha egasi | M | F1 | M | E1.2 |
| E1.4 | Stansiya kabineti: xatni ko'rish, ruxsat raqami berish/qaytarish | DS/DSP | M | F1 | M | E1.2 |
| E1.5 | Ruxsat → VagonFlow `WagonMemo(SUPPLY, NaryadStatus=NEW)` avto-naryad | tizim | S | F2 | L | E1.4, M4.2 |
| E2.1 | Aktivlar bozori: vagon/teplovoz/shahobcha e'loni (ijara/sotuv/xizmat) | egalar | S | F2 | M | K7 |
| E2.2 | Bitim (Deal): so'rov → kelishuv → eskrou → akt; e'lon haqi + komissiya | egalar, mijoz | S | F2 | L | M5.4 |
| E2.3 | Xususiy teplovoz kalendari (manevr so'rovlari, smena) | teplovoz | S | F2 | M | E2.1 |
| E2.4 | E'lonlar maydonchasi (kran, avtokran, fura) + VIP | xizmatchilar | S | F2 | S | K7 |
| E3.1 | Mutaxassislar bozori (ekspeditor/deklarant/logist profili, buyurtmaga qo'shish, 2 soat SLA) | mijoz, mutaxassis | S | F2 | L | M5.4 |
| E3.2 | Ekspeditor «ochiq buyurtmalar lentasi» | ekspeditor | S | F2 | M | E3.1 |
| E3.3 | Vakansiyalar (terminal e'lon, ariza) | terminal, izlovchi | C | F2 | S | K2 |
| E3.4 | Arbitraj va da'vo (foto-dalil, 3 kun SLA, eskroudan qoplash) | barcha, admin | S | F2 | M | M5.4 |
| E4.1 | Avtotashuvchilar bazasi + buyurtmaga «oxirgi milya» | mijoz | S | F1 | M | M2.5 |
| E4.2 | Avto-yuk birjasi (bo'sh qaytish e'lonlari) | haydovchi | C | F3 | L | M4.5 |
| E4.3 | Yonilg'i kartasi + tezkor to'lov haydovchiga | haydovchi | W | F4 | L | bank |
| E5.1 | Referal va sodiqlik (Bronze/Silver/Gold, imtiyozli slot) | mijoz | C | F3 | M | M6.1 |
| E5.2 | YukSaroy akademiyasi (mini-kurs, sertifikat) | mutaxassis | W | F4 | L | E3.1 |
| E5.3 | Telegram-bot orqali buyurtma/status (kichik mijoz) | mijoz | S | F1 | M | K4 |

Jami: 74 qator. «W» belgilanganlar — konsepsiyada bor, lekin 14 oygacha qurilmaydi.

## 3. MVP (F1) chegarasi

**Kiradi (F1, 3–4 oy, Toshkent tuguni 5–8 terminal):** K1–K6, K8, K9, M1.1–M1.3, M1.9 (bepul), M2.1–M2.5, M3.1–M3.3, M4.1–M4.2, M5.1, M5.6, M5.7, M6.1, E1.1–E1.4, E4.1 (ro'yxat sifatida), E5.3.

**Kirmaydi va nima uchun:**

| Kirmaydi | Sabab | Alternativa F1 da |
|---|---|---|
| Onlayn to'lov, eskrou, split (M5.2–M5.4) | Pilotda komissiya 0% — pul oqimi yo'q, 2–3 sprint bekor ketadi | Hisob-faktura PDF + bank o'tkazmasi; «to'landi» qo'lda |
| Native mobil (K10) | 7 rol × 2 platforma = XL; Store 2–4 hafta | PWA (K9) + Telegram bot |
| Aktivlar bitimlari (E2.2), teplovoz kalendari | Eskrousiz bitim — nizo xavfi, KYC yo'q | Shahobcha katalogi read-only (E1.1) |
| O'TY API (M4.4), TY kod avto | EBRD dasturi tizimlarni 2026–28 da o'zgartiradi; API yo'q | Operator qo'lda (Ish standarti 06) |
| AI narx/ETA | Ma'lumot yo'q — ≥3 oy bitim kerak | Formula + tarixiy o'rtacha (F3) |
| Tender, vakansiya, akademiya, referal | Yadro likvidligini bermaydi | — |

**F1 «wow» chegarasi:** landing (video-banner, 3D terminal sahnasi), katalog + xarita, 3 daqiqalik buyurtma, terminal kabineti, stansiya xati. Xat F1 da, chunki: oxirgi aniq talab, mavjud `Siding` ma'lumoti bilan arzon, hech kimda yo'q — pitch'dagi eng kuchli farqlovchi.

## 4. Top-7 user flow

Yozuv: Ekran (route) · Aktor · Tizim hodisasi · Holat.

### Flow 1 — Yuklash buyurtmasi + slot

| # | Ekran | Aktor | Tizim hodisasi | Holat |
|---|---|---|---|---|
| 1 | `/order/new` (1-qadam: yo'nalish/operatsiya) | Mijoz | `order.draft.created` | Order: DRAFT |
| 2 | `/order/new` (2: yuk ETSNG, vazn, vagon soni) | Mijoz | Terminal ro'yxati yaqin stansiya bo'yicha filtrlanadi | DRAFT |
| 3 | `/order/new` (3: terminal + qo'shimchalar) | Mijoz | `pricing.calculated` (formula ko'rsatiladi) | DRAFT |
| 4 | `/order/new` (4: slot jadvali) | Mijoz | `slot.hold` (10 daq optimistik qulf, boshqalarga yopiq) | Slot: HELD |
| 5 | `/order/new` (5: tasdiqlash) | Mijoz | `order.submitted`, terminalga push + Telegram, 30 daq taymer | Order: SUBMITTED |
| 6 | `/terminal/requests/:id` | Terminal | `order.confirmed` yoki `order.rejected{reason}` | CONFIRMED / REJECTED; slot BOOKED / FREE |
| 6a | (fon) | Tizim | 30 daq javob yo'q → `order.expired`, reyting −0,1, mijozga 2 alternativa | EXPIRED |
| 7 | `/orders/:id` | Terminal (skaner/kabinet) | `order.arrived` → `order.weighed{t}` → `order.loaded` | IN_PROGRESS podholatlar |
| 8 | `/orders/:id` | Tizim | Akt PDF, hisob-faktura, `order.completed` | COMPLETED |
| 9 | `/orders/:id/rate` | Mijoz | `rating.submitted` → terminal reytingi qayta hisoblanadi | RATED |

### Flow 2 — Tushirish (vagon kelishi → topshirish)

| # | Ekran | Aktor | Hodisa | Holat |
|---|---|---|---|---|
| 1 | (push/Telegram) | Tizim | VagonFlow `Request.lifecycle=AWAITING_ARRIVAL` yoki mijoz kiritgan vagon № → `eta.alert` (24 soat oldin) | — |
| 2 | `/order/new?op=unload&wagon=…` | Mijoz | Vagon № oldindan to'ldirilgan, stansiya aniqlanadi, terminallar shu stansiyadan | Order: DRAFT |
| 3 | `/order/new` (qo'shimchalar: saqlash, oxirgi milya, deklarant) | Mijoz | `order.submitted` | SUBMITTED |
| 4 | `/terminal/requests/:id` + `/terminal/resources` | Terminal | Kran/brigada/maydon slotga biriktiriladi; `order.confirmed` | CONFIRMED |
| 5 | `/orders/:id` | Terminal | `wagon.arrived{at}` → demurraj taymeri start | IN_PROGRESS |
| 6 | `/orders/:id` | Terminal | `order.unloaded`, `weight.checked`, `wagon.released{at}` → taymer stop, ortiqcha soat kimniki — hisoblanadi | UNLOADED |
| 7 | `/orders/:id` | Tizim | Avto bo'lsa haydovchi tayinlanadi, trek-havola; akt + faktura | COMPLETED |
| 8 | `/orders/:id/rate` | Mijoz | Baholash | RATED |

### Flow 3 — Stansiya boshlig'iga xat / ruxsat oqimi (oxirgi talab)

Entity: `SidingAccessRequest {sidingId, orgId, cargoType, wagons[], periodFrom, periodTo, ownerConsent, stationDecision, permitNo, pdfUrl}`.

| # | Ekran | Aktor | Hodisa | Holat |
|---|---|---|---|---|
| 1 | `/assets/sidings` → karta | Mijoz | Shahobcha topildi (uzunlik, sig'im, egasi, `contractState`) | — |
| 2 | `/sidings/:id/deal` (chat/so'rov) | Mijoz ↔ Egasi | Narx/shart kelishildi → `deal.agreed` | Deal: AGREED |
| 3 | `/sidings/:id/letter/new` | Mijoz | Konstruktor: korxona (STIR dan avto), yuk turi, vagon raqamlari (qo'lda/CSV/VagonFlow Request dan), davr dan–gacha; jonli ko'rinish (firma blankasi, stansiya boshlig'i nomiga) | SAR: DRAFT |
| 4 | `/sidings/:id/letter/:sar` → «Egasiga yuborish» | Mijoz | `sar.owner_review_requested` → egasiga push | OWNER_REVIEW |
| 5 | `/owner/consents/:sar` | Shahobcha egasi | «Qarshi emasman» (SMS-kod F1 / ERI F2) yoki rad (sabab) | OWNER_CONSENTED / OWNER_DECLINED |
| 6 | `/sidings/:id/letter/:sar` | Tizim | PDF (+DOCX) yakuniy: raqam `YS-XAT-2026-000123`, QR tekshiruv havolasi, rozilik bloki; «Stansiyaga yuborish» faollashadi | READY |
| 7 | «Stansiyaga yuborish» | Mijoz | `sar.sent` → stansiya kabineti + Telegram; mijoz yuklab olib qog'ozda ham topshirishi mumkin (F1 fallback) | SENT |
| 8 | `/station/letters/:sar` | Stansiya boshlig'i | Vagonlar, davr, shahobcha sig'imi (`capacityWagons` − `occupiedWagons`) ko'rinadi; «Ruxsat» → `permitNo` yoki «Qaytarish{sabab}» | STATION_APPROVED / RETURNED |
| 9 | (fon) | Tizim | F2: VagonFlow'ga `WagonMemo(operation=SUPPLY, status=NEW, sidingId, wagonNo[])` — DSP smenasiga naryad | NARYAD_ISSUED |
| 10 | `/station/letters/:sar` | DSP (VagonFlow) | `NaryadStatus=PLACED/NOT_PLACED` webhook → mijozga «vagon shahobchaga qo'yildi» | ACTIVE |
| 11 | (fon, `periodTo` + 1 kun) | Tizim | `sar.closed`; davr tugagach kelgan vagon → «davr tashqarisi» ogohlantirish | CLOSED / EXPIRED |

Nima uchun VagonFlow `WagonMemo` ga bog'lanadi: DSP javob mexanizmi (NEW→PLACED/NOT_PLACED) allaqachon ishlab turibdi — ikkinchi naryad tizimi qurilmaydi. Alternativa (YukSaroy ichida o'z naryadi) rad: DSP ikki tizimga kirishi kerak bo'lardi.

### Flow 4 — TY kod olish

| # | Ekran | Aktor | Hodisa | Holat |
|---|---|---|---|---|
| 1 | `/code/apply` | Mijoz | STIR, rekvizit, stansiya, oylik hajm; cheklist yuklash | CodeApp: DRAFT |
| 2 | `/code/apply` → yuborish | Mijoz | `codeapp.submitted`, avtotekshiruv (STIR formati, dublikat) | SUBMITTED |
| 3 | `/admin/code-apps/:id` | Operator | Hujjatlar tekshirildi → O'TY bo'limiga yuborildi (F1: elektron pochta/qo'lda, F2: API) | FORWARDED (3 ish kuni taymer) |
| 4 | `/admin/code-apps/:id` | Operator | Kod + hisob raqami kiritiladi | ISSUED |
| 5 | `/code` | Mijoz | Profilga ulanadi, «vagon talabnomasi» va «balans to'ldirish» ochiladi | ACTIVE |
| 5a | (fon) | Tizim | 3 ish kunidan oshsa → eskalatsiya adminga | ESCALATED |

### Flow 5 — «Stol uslug» hujjat buyurtmasi

| # | Ekran | Aktor | Hodisa | Holat |
|---|---|---|---|---|
| 1 | `/docs/new` | Mijoz | Tur (GU-29/SMGS/GU-12/qayta jo'natish/VU), buyurtmaga bog'lash, narx darhol | Doc: DRAFT |
| 2 | yuborish | Mijoz | `doc.ordered`, 4 ish soati SLA | ORDERED |
| 3 | `/admin/docs/:id` | Mutaxassis | Buyurtma ma'lumotidan shablon to'ldiriladi, xato tekshiruvi | IN_WORK |
| 4 | `/admin/docs/:id` | Mutaxassis | PDF + ERI (F2) | READY |
| 5 | `/docs/:id` | Mijoz | Kabinetga tushadi, buyurtmaga biriktiriladi, push | DELIVERED |
| 5a | — | Mijoz | Tuzatish so'rovi (1 marta bepul) | REVISION |

### Flow 6 — Aktivlar bozori (vagon ijarasi)

| # | Ekran | Aktor | Hodisa | Holat |
|---|---|---|---|---|
| 1 | `/assets/new` | Vagon egasi (KYC o'tgan) | E'lon: tur, soni, VU-36 ko'rik, narx/oy, stansiya | Listing: MODERATION |
| 2 | `/admin/listings` | Admin | Tasdiq (24 soat) | ACTIVE |
| 3 | `/assets/:id` → «So'rov yuborish» | Mijoz | `deal.requested{qty, period}` | Deal: REQUESTED |
| 4 | `/owner/deals/:id` | Egasi | Taklif/kontr-taklif | NEGOTIATION |
| 5 | `/deals/:id` | Ikkalasi | Kelishildi → e'lon haqi + komissiya hisoblanadi; F2: eskrou | AGREED / ESCROW_FUNDED |
| 6 | `/deals/:id` | Egasi | Vagonlar topshirildi (raqamlar) | IN_PROGRESS |
| 7 | `/deals/:id` | Mijoz | Qabul akti → eskrou yechiladi, baho | COMPLETED |

### Flow 7 — Ekspeditor buyurtma

| # | Ekran | Aktor | Hodisa | Holat |
|---|---|---|---|---|
| 1 | `/order/new` (qo'shimcha: «mutaxassis kerak») | Mijoz | Buyurtmaga `ProService` qo'shiladi | Order: SUBMITTED + ProOrder: OPEN |
| 2 | `/pro/feed` | Ekspeditor | Ochiq buyurtmalar lentasi (hudud/ixtisos filtri), 2 soat SLA | OPEN |
| 3 | `/pro/feed/:id` → «Qabul qilaman» | Ekspeditor | `pro.accepted` (birinchi qabul qilgan oladi; javobsiz 2 soat → keyingisiga) | ASSIGNED |
| 4 | `/orders/:id` | Mijoz | Mutaxassis profili, narx; F2: eskrou muzlatiladi | ESCROW_FUNDED |
| 5 | `/pro/orders/:id` | Ekspeditor | Ish qadamlari (hujjat, vagon, avto) belgilanadi | IN_PROGRESS |
| 6 | `/orders/:id` | Mijoz | Qabul → eskrou yechiladi, 1–5 baho | COMPLETED |
| 6a | `/disputes/new` | Mijoz/Ekspeditor | Nizo → arbitraj 3 ish kuni | DISPUTED |

## 5. North-star va KPI daraxti

**North-star:** oylik **bajarilgan onlayn buyurtmalar soni** (Completed Booked Orders, CBO) — onlayn band qilingan slot bo'yicha real bajarilgan va akt bilan yopilgan buyurtmalar. Nima uchun GMV emas: pilotda komissiya 0%, GMV terminal tarifiga bog'liq va manipulyatsiyaga ochiq; CBO ikki tomonning ham qiymat olganini ko'rsatadi. Maqsadlar: F1 oxiri 300 CBO/oy (5–8 terminal), F2 oxiri 1 500, F3 oxiri 3 000 (konsepsiya ssenariysi: 20 terminal × 150).

```
CBO/oy
├─ Taklif (supply)
│  ├─ Jonli terminallar soni (F1: 5–8, F3: 60+)
│  ├─ Pasport to'liqligi ≥90% (tarif + kran + ish vaqti)
│  └─ Slot qamrovi: e'lon qilingan slot/ish soati ≥80%
├─ Talab (demand)
│  ├─ Aktivlashtirilgan mijozlar (18 428 bazadan; to'lqin konversiyasi ≥8%)
│  ├─ Haftalik faol tashkilotlar (WAO)
│  └─ Yaratilgan buyurtmalar/oy
├─ Konversiya
│  ├─ DRAFT→SUBMITTED ≥60%
│  ├─ SUBMITTED→CONFIRMED ≤30 daq: ≥90%
│  ├─ CONFIRMED→COMPLETED ≥92% (no-show ≤8%)
│  └─ Takroriy buyurtma 30 kunda ≥50%
├─ Sifat
│  ├─ O'rtacha reyting ≥4,5; SLA buzilishlari/100 buyurtma ≤5
│  ├─ Demurraj soat/vagon (−40% pilot boshiga nisbatan)
│  └─ Nizo ulushi ≤2%, yopilish ≤3 ish kuni
├─ Monetizatsiya (F2+)
│  ├─ GMV, take rate (2–4%), SaaS MRR (terminal × 1,5 mln)
│  ├─ Aktivlar/e'lon daromadi, stol uslug hujjat/oy
│  └─ CAC payback ≤6 oy
└─ Xat/ruxsat oqimi (E1)
   ├─ Xat→ruxsat median vaqti ≤4 ish soati
   └─ Ruxsat→PLACED ulushi ≥85%
```

## 6. Epiklar backlog (2 haftalik sprint, 3–4 dev + 1 dizayner)

| ID | Epik | Faza | Baho (sprint) | Qamrov |
|---|---|---|---|---|
| EP01 | Identity & Org: telefon+SMS, STIR reestr importi, ko'p-rol, oferta | F1 | 1,5 | K1–K3 |
| EP02 | Bildirishnoma yadrosi (Telegram bot + FCM + SMS, shablonlar) | F1 | 1 | K4, E5.3 |
| EP03 | Terminal pasporti + tarif matritsasi + admin CRUD | F1 | 1,5 | M1.1, M3.2 |
| EP04 | Katalog + xarita (railmap ESR, filtr, saralash) | F1 | 2 | M1.2–M1.3 |
| EP05 | Landing «wow»: video-banner, 3D terminal sahnasi, tez kalkulyator, logo tizimi | F1 | 2 | M3.3 |
| EP06 | Buyurtma konstruktori + narx formulasi | F1 | 2 | M2.1, M2.5, M3.1 |
| EP07 | Slot dvigateli (hold/expire/booked, poyga holatlari, DB cheklovlari) | F1 | 1,5 | M2.2, M2.4 |
| EP08 | Terminal kabineti (talabnomalar, SLA taymer, slot boshqaruvi) | F1 | 1,5 | M2.3 |
| EP09 | Buyurtma holat mashinasi + kuzatuv + akt/faktura PDF | F1 | 1,5 | M4.1, M5.1 |
| EP10 | VagonFlow integratsiya v1 (webhook: Request/WagonMemo → Order timeline) | F1 | 1,5 | M4.2 |
| EP11 | Shahobcha katalogi (Siding import) + stansiya xati konstruktori + rozilik + stansiya kabineti | F1 | 2,5 | E1.1–E1.4 |
| EP12 | Reyting + audit + admin SLA monitor | F1 | 1 | M6.1, K5, K8 |
| EP13 | Stol uslug + TY kod arizasi (operator navbati) | F1 | 1,5 | M5.6–M5.7 |
| EP14 | PWA + offline kesh + i18n | F1 | 1 | K9, K6 |
| EP15 | To'lov: invoice + Payme/Click/Uzum + split + eskrou | F2 | 3 | M5.2–M5.4 |
| EP16 | KYC/verifikatsiya + anti-frod | F2 | 1,5 | K7, M6.6 |
| EP17 | Aktivlar bozori + bitimlar + teplovoz kalendari + e'lonlar | F2 | 3 | E2.1–E2.4 |
| EP18 | Mutaxassislar bozori + ekspeditor lentasi + arbitraj | F2 | 2,5 | E3.1–E3.4 |
| EP19 | Ruxsat → VagonFlow naryad (WagonMemo SUPPLY) + DSP webhook | F2 | 1 | E1.5 |
| EP20 | Demurraj taymeri + 24 soat ETA ogohlantirish + resurs rejasi | F2 | 2 | M4.3, M4.7, M2.6 |
| EP21 | Gate-slot (avto) + haydovchi ilovasi + GPS | F2 | 3 | M2.7, M4.5 |
| EP22 | Native mobil (Expo/React Native, 7 profil) | F2 | 4 | K10 |
| EP23 | ERI (E-IMZO QR) hujjatlarga + 1C eksport | F2/F3 | 1,5 | M5.5, M5.10 |
| EP24 | Analitika: terminal, boshqaruv dashboard, mijoz hisoboti | F2/F3 | 2 | M6.2–M6.4 |
| EP25 | SaaS-obuna rejalari + premium joylashuv billing | F2 | 1 | M1.9 |
| EP26 | O'TY API (dislokatsiya, balans) — EBRD tizimlari chiqqach | F3 | 3 | M4.4, M5.8 |
| EP27 | Rassrochka + sug'urta (bank/sug'urta hamkor API) | F3 | 2,5 | M5.9, M5.11 |
| EP28 | AI narx/ETA (tarixiy ma'lumot ≥3 oy) | F3 | 2 | M3.4, M4.6 |
| EP29 | Tender + referal/sodiqlik | F3 | 2 | M2.10, E5.1 |
| EP30 | Xalqaro portlar + akademiya + faktoring | F4 | 4+ | M1.8, E5.2, M5.12 |

F1 jami ≈ 23 sprint-birlik → 3–4 dev parallelida 8–9 sprint (4 oy) — konsepsiyadagi F1 muddatiga mos. Eng katta xavf: EP11 (2,5) — VagonFlow bilan sxema kelishuvi kechiksa, xat oqimi PDF + qo'lda topshirish (Flow 3, 7-qadam fallback) bilan chiqariladi.

## 7. Taxminlar va tekshiriladigan gipotezalar

| # | Gipoteza | Qanday tekshiriladi | Muddat |
|---|---|---|---|
| H1 | Terminallar tarifini ochiq e'lon qilishga rozi | F0 memorandum: 5 terminaldan ≥3 tarif jadvalini beradi | F0 |
| H2 | Terminal 30 daqiqada javob bera oladi | 2 hafta pilot: SLA ≥80% bo'lmasa — 60 daq + auto-accept | F1 |
| H3 | 18 428 mijozning ≥8% birinchi SMS to'lqinida aktivlanadi (telefonlar reestrda yo'q!) | 500 mijozlik to'lqin; telefon manbasi: «Yagona darcha» logini / MTU ro'yxati | F0–F1 |
| H4 | Stansiya boshlig'i elektron xatni rasmiy deb qabul qiladi | Sergeli, Chuqursoy bilan sinov; kerak bo'lsa QR + qog'oz (gibrid) | F1 |
| H5 | Shahobcha egalari sig'imni begonalarga beradi | 30 ta `usageType=PRIVATE` egasi bilan intervyu; ≥10 «ha» | F0 |
| H6 | B2B mijoz 3% komissiyani to'laydi | F2 A/B: 3% mijozdan vs SaaS-only (terminal to'laydi) | F2 |
| H7 | Slot modeli t/y terminalda ishlaydi (vagon berish O'TY'ga bog'liq) | Slot o'tkazib yuborishning ≥50% sababi «vagon kech berildi» bo'lsa, slot vagon kelishiga bog'lanadi | F1 |
| H8 | «Stol uslug» bepul e-nakl portalidan farqli qiymat beradi | 30 kunda ≥40 buyurtma bo'lmasa — faqat SMGS/qayta jo'natish qoladi | F1 |
| H9 | VagonFlow webhook'lari ishonchli (qo'lda kiritish kechikishi) | Kechikish median ≤2 soat | F1 |
| H10 | Ekspeditor/deklarant eskrouga rozi (pul 3–5 kun muzlaydi) | 10 intervyu; ≥6 rozi bo'lmasa — «keyin to'lash + reyting» | F2 |
| H11 | Tarif balansi to'ldirish uchun litsenziya/O'TY roziligi kerak | Yuridik tekshiruv; bo'lmasa Oqim 7 o'chiriladi | F0 |
| H12 | Rassrochka ustama (+4/+8/+14%) bank pul narxidan yuqori | Bank pul narxi ≤12% yillik bo'lsa mantiqli | F2 |
| H13 | Terminal SaaS 1,5 mln so'm/oy to'laydi | 3 reja, 20 terminaldan ≥8 obuna | F2 |
| H14 | Haydovchilar gate-slotga kelishadi | No-show ≤15% bo'lmasa — fiksatsiya to'lovi | F2 |
| H15 | O'TY API 2027 gacha ochilmaydi | EBRD jadvali kuzatiladi; F3 shunga moslanadi | doimiy |

PM xulosasi: F1 da uchta narsa isbotlanadi — terminal 30 daqiqada javob beradi (H2), mijoz onlayn buyurtma beradi (H3), stansiya elektron xatni qabul qiladi (H4). To'lov, aktivlar, mutaxassislar, AI — shu uchtasi ishlagandan keyin.
