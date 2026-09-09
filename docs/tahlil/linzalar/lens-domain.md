# YukSaroy — Temir yo'l domeni va huquqiy muvofiqlik (lens: domain)

Holat sanasi: 2026-09-03. Manbalar: railway.uz, e-nakl.railway.uz (oferta), lex.uz, gazeta.uz, spot.uz, buxgalter.uz, EBRD, CIT/OSJD. Har bo'limda "nima uchun" va "alternativa" bor.

## 0. Qisqa xulosa (PM uchun 7 fakt)

1. Temir yo'l hujjat aylanmasi O'TYda allaqachon raqamlashgan: **«Yagona darcha» (e-nakl.railway.uz)**, operator — **«DAS UTY» MChJ**; unda GU-27/GU-29/GU-45/GU-34/FDU-92 to'ldiriladi, ERI bilan imzolanadi, ELS balansi ko'rinadi, vagon kuzatiladi. YukSaroy buni **takrorlamaydi**, uning atrofidagi bozorni (terminal, shahobcha, manevr, SVX, ekspeditor) quradi.
2. Oferta bo'yicha «Yagona darcha» huquqlarini uchinchi shaxsga o'tkazish taqiqlangan → mijoz nomidan avtomatik kirish (scraping/robot-login) **yo'q**. Yagona qonuniy yo'l — DAS UTY bilan axborot almashinuv shartnomasi (ETTYuX↔e-nakl integratsiyasi bunday API texnik jihatdan borligini isbotlaydi).
3. 29.05.2025 dan yangi **«Temir yo'l transporti to'g'risida» qonun (ZRU-1006)** ishlaydi: noumumiy yo'l (shahobcha) egasi **pullik xizmat** (vagon qo'yish-olish, saqlash, yuklash-tushirish) ko'rsatishi mumkin, narx raqobat qonunchiligi ostida. Bu YukSaroy "Aktivlar bozori" moduliga to'g'ridan-to'g'ri huquqiy asos.
4. Shaxsiy ma'lumotlar: ZRU-1125 (26.03.2026) lokalizatsiyani yumshatdi (faqat biometrik/genetik/telekom). Baribir O'zbekistonda hosting tavsiya — davlat AJ bilan hamkorlikda "chet el serveri" o'zi to'siq.
5. Rassrochka: **PP-294 (14.08.2026)**, 01.01.2027 dan operatorlar MB ro'yxatiga kiradi, limit 250 BHM (≈110 mln so'm), ≤12 oy, ustama yiliga ≤50%. Konsepsiyadagi "tizim o'z mablag'idan to'laydi" = rassrochka operatori → ro'yxat yoki bank/MFO hamkor.
6. To'lov: ZRU-578 — to'lov xizmati MB litsenziyasi, lekin **to'lov agenti** bank/to'lov tashkiloti bilan agentlik shartnomasi orqali litsenziyasiz ishlaydi. Eskrou — bank hisobi orqali (FKda alohida institut hali yo'q). Platforma pul ushlab turmasin.
7. Marketpleys: «Elektron tijorat to'g'risida» qonun (2022, 17.04.2025 tahriri, 05.2026 qo'shimchalari) — operator faqat rezident yuridik shaxs, 01.07.2025 dan **uvedomlenie**, sotuvchini tekshirish, **subsidiar javobgarlik**, soliq agenti funksiyasi.

---

## 1. Modul bo'yicha real jarayon va hujjatlar

### 1.1 Onboarding: TY kod (yuk jo'natuvchi kodi) + ELS + shartnoma

Amaldagi tartib (railway.uz "Yagona darcha" bo'limi, e-nakl oferta):

| Qadam | Kim | Hujjat/tizim | Muddat (amalda) |
|---|---|---|---|
| 1. Ariza + rekvizitlar (STIR, ustav, direktor buyrug'i, bank) | Mijoz | e-nakl.railway.uz ro'yxat, oferta aksepti | 1 kun |
| 2. Hududiy tugun (MTU) / TexPD bilan elektron shartnoma | Mijoz ↔ MTU | "Yuk tashishni tashkil etish shartnomasi" (ERI) | 1–3 kun |
| 3. Kod tayinlash | O'TY AXM (Axborot-hisoblash markazi) | 4 raqamli yuk jo'natuvchi/oluvchi kodi (ASOUPda) | 1–2 kun |
| 4. ELS (yagona shaxsiy hisob) | TexPD | 100% avans (oferta 4-b.), balans kabinetda | avtomatik |
| 5. Stansiyaga biriktirish | MTU | Client.stationId (VagonFlow) | — |

Nima uchun YukSaroy "TY kod olish" ni bir tugma qiladi: kod bo'lmasa GU-12 ham, nakladnoy ham yo'q — bu voronkaning birinchi to'sig'i. F1da platforma operatori mijoz nomidan ishonchnoma bilan yuradi (huquqiy shakl: **vositachilik shartnomasi + ERI ishonchnoma**), F2da DAS UTY API. Alternativa — mijozni e-nakl'ga yo'naltirish (deep-link) va faqat chek-list berish; arzon, lekin "stol uslug" daromadi yo'qoladi.

### 1.2 GU-12 talabnoma

GU-12 — vagon/yuk tashish talabnomasi: jo'natish stansiyasi (ESR), yuk ETSNG kodi, vagon turi, egalik (CARGO/MPS/SPS — VagonFlow `Ownership`), yo'nalish (LOCAL/EXPORT), kunlar bo'yicha vagon soni. O'TYda tasdiqlash zanjiri VagonFlow'da allaqachon modellashgan: `approvalStage` 1=MTU → 2=Kargo → 3=Boshqarma. YukSaroy GU-12ni **yaratmaydi**, VagonFlow `Request` ga `POST /api/requests` orqali yuboradi va `RequestStatus` ni o'qiydi. Nima uchun: bitta haqiqat manbai; ikki tizimda talabnoma bo'lsa stansiya ikkita raqam ko'radi.

### 1.3 Nakladnoy va yo'l hujjatlari (terminologik tuzatish)

Konsepsiyada "GU-29 nakladnoy" deyilgan — bu noto'g'ri. To'g'ri to'plam (railway.uz "Yagona darcha" ro'yxati):

| Forma | Nomi (ru) | Kim to'ldiradi | YukSaroyda |
|---|---|---|---|
| GU-27 | Транспортная железнодорожная накладная | jo'natuvchi | "Stol uslug" — tayyorlash xizmati |
| GU-29, GU-29b | Дорожная ведомость | stansiya | faqat ko'rish |
| GU-45 | Памятка приёмосдатчика (подача/уборка) | stansiya + shahobcha egasi | demurraj taymeri manbai |
| GU-46 | Ведомость подачи и уборки вагонов | stansiya | shahobcha hisob-kitobi |
| GU-34 | Книга приёма груза к отправлению | stansiya | status "qabul qilindi" |
| FDU-92 | Накопительная карточка (yig'imlar) | TexPD | ELS yechimlar tafsiloti |
| SMGS | Xalqaro yuk xati (OSJD, 2025-12-12 CIM/SMGS qo'llanmasi) | jo'natuvchi | "Stol uslug", ETSNG+GNG |
| ETTYuX | Elektron tovar-transport yuk xati (soliq.uz) | jo'natuvchi | vagon raqami kiritilsa e-nakl'dan avtomatik to'ladi |

ETTYuX↔e-nakl integratsiyasi (buxgalter.uz): vagon raqami kiritilganda jo'natuvchi/oluvchi, stansiyalar, yuk, masofa va narx avtomatik keladi — ya'ni O'TYda mashina-o'qiladigan interfeys bor.

### 1.4 Kodlar va klassifikatorlar

- **ETSNG** — 6 raqam, ilk 2 raqam guruh (masalan 01 — g'alla). Tarif sinfi shu koddan chiqadi. Manba: alta.ru ETSNG spravochnigi; O'TY o'z nusxasini ishlatadi (foydalanuvchida fayl bor).
- **GNG** — 8 raqamli xalqaro nomenklatura (SMGS uchun ETSNG bilan juft yoziladi).
- **ESR** — stansiya kodi, 6 raqam (5 + nazorat), O'TY diapazoni 72xxxx; VagonFlow `Station.ecpCode`. railway.uz'da 300+ stansiya + 17 tijorat operatsiya kodi (1–12, K) jadvali ochiq — bu "qaysi stansiya konteyner/20t/30t qabul qiladi" katalogining rasmiy manbai.
- **Vagon raqami** — 8 raqam, 8-si nazorat (mod-10). Platformada validator majburiy: noto'g'ri raqam → GU-45/ETTYuX xato.
- **STIR** (INN) — 9 raqam, yuridik shaxs identifikatori; KYC kaliti.

### 1.5 Tarif va to'lov

2024 dan yuk tariflari bozor asosida (10.10.2023 farmon, holding reformasi). 01.07.2026 dan shartnomaviy (erkin) narxlar, **shahobcha yo'lga vagon qo'yish-olish** stavkalari +5%; O'TY lokomotivining manevr ishi **510 823 so'm (QQSsiz)** (spot.uz, 12.06.2026); qo'riqlash 1 386 so'm/vagon-km. O'TY yangi tarif metodikasini tayyorlamoqda (spot.uz, 21.08.2026) — kalkulyator formulasini **konfiguratsiyada** saqlash kerak, kodda emas. Xalqaro tashuvda "Тарифная политика ж.д. СНГ" (yillik). To'lov: ELS avans; YukSaroy kalkulyatori e-nakl kalkulyatorini almashtirmaydi — terminal/xizmat narxini hisoblaydi, temir yo'l tarifi "taxminiy, O'TY hisobiga ko'ra aniqlanadi" belgisida.

### 1.6 Demurraj / vagon turib qolishi

Ikki xil to'lov: (a) O'TY inventar vagonlari — "плата за пользование вагонами" (soatlab, GU-45 vaqtidan), (b) umumiy yo'lda turish — "плата за нахождение/хранение". Xususiy (SPS) vagon — egasi bilan shartnoma (odatda sutkasiga). Hisob boshlanishi: GU-45da qo'yish vaqti; tugashi — olib chiqish uchun tayyorlik xabari (ГУ-2б/уведомление). YukSaroy taymeri **GU-45 vaqtidan** boshlanishi kerak, slot vaqtidan emas — aks holda terminal bilan nizo. Ish standartidagi "demurraj terminal hisobidan" SLA qoidasi faqat terminal aybi (slot berib, qabul qilmagan) uchun ishlaydi; sabab kodi (`delayReason`: TERMINAL / CLIENT / RAILWAY) majburiy maydon.

### 1.7 Shahobcha yo'l shartnomasi (подача-уборка)

Uch xil shartnoma bor, chalkashtirmaslik kerak:

| Shartnoma | Tomonlar | Qachon |
|---|---|---|
| Shahobcha yo'lni ekspluatatsiya qilish shartnomasi | O'TY (stansiya/MTU) ↔ yo'l egasi | egasi o'z lokomotivi bilan ishlasa |
| Vagon qo'yish-olish shartnomasi | O'TY ↔ yo'l egasi yoki **kontragent** | O'TY lokomotivi ishlasa |
| Kontragent shartnomasi (uchinchi shaxs) | yo'l egasi ↔ boshqa yuk egasi | **aynan foydalanuvchi so'ragan holat** |

Shartnoma ilovasi: ЕТП (yagona texnologik jarayon) yoki yuklash-tushirish vaqt normasi (VagonFlow `Siding.processingHours`, `loadNorm`, `unloadNorm`), bir vaqtda beriladigan vagonlar (`capacityWagons`), tutashuv strelkasi (`junctionSwitch`), tormoz bashmoqlari (`brakeShoes`). ZRU-1006 (27.11.2024, 29.05.2025 dan) noumumiy yo'l egasiga pullik xizmat huquqini berdi — demak "shahobcha ijarasi" emas, aniqrog'i **"shahobcha xizmati shartnomasi"** (yuridik jihatdan xavfsizroq: ijara — yer va O'TY tutashuv roziligi masalasini ochadi). Alternativa: sub-ijara — faqat egasi yer huquqi va O'TY tutashuv shartnomasida ruxsat bo'lsa.

### 1.8 Stansiya boshlig'iga xat va vagonlarni shahobcha yo'lga qo'yish ruxsati

Amaldagi zanjir (Yuk tashish qoidalari + ТРА stansiya + ЕТП):

1. **Yuk egasi (kontragent)** → stansiya boshlig'i (**DS**) nomiga xat: yuk egasi rekvizitlari, STIR, TY kodi, yuk ETSNG, vagon raqamlari yoki kutilayotgan soni, shahobcha yo'l nomi, davr (dan–gacha), "shu davrda kelgan vagonlarni ... shahobcha yo'liga qo'yib berishingizni so'rayman".
2. **Shahobcha egasi** — xatga viza "qarshi emasman" + kontragent shartnomasi raqami (yoki xatning o'zi shartnoma o'rnini bosmaydi — shuning uchun platformada avval `SidingServiceContract` tuziladi, keyin xat).
3. **DS** — rezolyutsiya (ruxsat), agar shartnoma yo'q bo'lsa MTU (NOD/DNCH darajasi) bilan kelishadi. VagonFlowda `DNCH` roli shu darajaga mos.
4. **DSP** (smena navbatchisi) — GU-45 pamyatka ochadi, manevr topshirig'ini beradi; poyezd dispetcheri **DNC** uchastka bo'yicha "okno" beradi. Jurnallar: **ДУ-58** (dispetcher buyruqlari), **ДУ-2** (poyezdlar harakati), **ГУ-45/ГУ-46**, shahobcha egasida — vagonlar hisobi daftari.
5. Nakladnoyda oluvchi manzili: "…с подачей на подъездной путь «Biokimyo» по договору №…".

Platformada: xat = `StationLetter` (docx/PDF, ERI bilan 2 imzo: yuk egasi + shahobcha egasi), `permitNo` va `permitDate` — DS tasdiqlagach. Yuklab olish + stansiya kabinetiga elektron topshirish. Nima uchun ERI ikkalasida: stansiya ERIsiz xatni qabul qilmaydi (ZRU-793: faqat ERI yuridik kuchga ega). Alternativa: QR + platforma tasdig'i — faqat stansiya rozi bo'lsa (pilotda kelishuv).

### 1.9 Xususiy teplovoz manevr xizmati

- Shahobcha ichida egasining lokomotivi — `Siding.locoType=PRIVATE`, mashinist guvohnomasi, ТО/ТР hujjatlari, "Инструкция о порядке обслуживания и организации движения на подъездном пути" (ТРА ilovasi).
- Umumiy yo'lga chiqish — ruxsat tartibi: PKM-72 (31.03.2015) 01.03.2022 dan kuchini yo'qotgan; hozir ZRU-701 (14.07.2021, 14.04.2026 tahriri) ostidagi ruxsatnomalar + PTE, "акт допуска" O'TY (lokomotiv xo'jaligi). Lokomotiv tortish xizmati narxi ZRU-1006 bo'yicha **davlat tartibga soladi** — xususiy teplovoz uchun "1,8 mln so'm/soat" e'loni faqat noumumiy yo'lda qonuniy.
- Platforma: e'lon egasi profilida `locoPermitNo`, `driverLicenseNo`, `insurance` — verifikatsiyasiz "Tasdiqlangan" belgisi berilmaydi. Nima uchun: hodisa bo'lsa "platforma tekshirmagan" — subsidiar javobgarlik.

### 1.10 SVX / bojxona ombori

Litsenziya — PKM-1028 (18.12.2018), "Лицензия" AKT tizimi orqali, bojxona ombori egalari reyestri; rejim "vaqtincha saqlash" (PKM-447, 17.06.1998, Bojxona kodeksi). Platforma ombor litsenziya raqami va amal muddatini kiritadi, customs.uz reyestri bilan qo'lda solishtiradi (ochiq API yo'q). Alternativa — litsenziya PDF yuklash + operator tekshiruvi.

### 1.11 Tarozilar

Vagon tarozilari — davlat metrologik nazorati (Uzstandart), poverka guvohnomasi (odatda 12 oy); stansiyada **ГУ-36** (qayta tortish kitobi). Reyestrda: `scaleType` (vagon/avto/dinamik), `maxT`, `certNo`, `certUntil`. Muddati o'tgan tarozi katalogda "faol emas".

---

## 2. O'TY tizimlari va API ochiqligi (real holat)

| Tizim | Nima | Ochiqlik | Ruxsat beruvchi |
|---|---|---|---|
| «Yagona darcha» e-nakl.railway.uz | shartnoma, GU-27/29/45/34, FDU-92, ELS, ERI, kuzatuv, mobil ilova | Oferta: huquq o'tkazish taqiqlangan; ochiq API e'lon qilinmagan; ETTYuX bilan B2G integratsiya bor | DAS UTY MChJ + O'TY Yuk tashish departamenti |
| ASOUP | operativ boshqaruv, vagon dislokatsiyasi, kodlar | yopiq; ma'lumot faqat shartnoma bo'yicha | O'TY AXM |
| GID-Ural (grafik) | poyezd harakati grafigi | yopiq | O'TY Harakat boshqarmasi |
| EBRD loyihasi (€38,4 mln, 17.06.2026) | dispetcherlik, rejalashtirish, kiberxavfsizlik | 2027+ da yangi platforma; API rejasi e'lon qilinmagan | O'TY Boshqaruvi |
| railway.uz ochiq sahifalar | stansiyalar jadvali (ESR + operatsiya kodlari), tarif preferensiyalari 2026, xizmatlar ro'yxati PDF | ochiq (parse mumkin) | — |

Integratsiya darajalari (tavsiya ketma-ketligi):

- **L0 (F1)** — mijoz vagon raqamini qo'lda kiritadi; hujjat PDF/QR; O'TY bilan aloqasiz. Ishga tushirish 0 kun.
- **L3 (F1)** — VagonFlow orqali: `Station`, `Siding`, `Client`, `Request`, `Locomotive`, `LocoShift` allaqachon bor; YukSaroy VagonFlow'ni "temir yo'l tomoni" adapteri sifatida ishlatadi. Nima uchun: VagonFlow'da stansiya xodimlari ma'lumot kiritadi — bu de-fakto dislokatsiya oqimi.
- **L2 (F2)** — DAS UTY bilan **axborot almashinuv shartnomasi** (ETTYuX andozasi): vagon raqami → holat, ELS balans (mijoz roziligi bilan), GU-12 statusi. Kim imzolaydi: O'TY Boshqaruvi raisi o'rinbosari (yuk tashish) + DAS UTY direktori; yo'l: memorandum → texnik topshiriq → shartnoma.
- **L1 (taqiq)** — mijoz login/paroli bilan robot-kirish. Oferta buzilishi + ZRU-547 (login — shaxsiy ma'lumot) → qilinmaydi.

---

## 3. Huquqiy muvofiqlik

### 3.1 Shaxsiy ma'lumotlar (ZRU-547, 02.07.2019)

- Lokalizatsiya: 2021 (ZRU-666) barcha fuqarolar ma'lumotini O'zbekistonda saqlashni talab qilgan; **ZRU-1125 (26.03.2026)** — majburiy lokalizatsiya faqat biometrik, genetik va telekom foydalanuvchilari ma'lumotlariga; qolgani chet elda — adekvat davlat / SCC-BCR / xavfsizlik talablari shartida (gazeta.uz, servercore).
- Reyestr: pd.gov.uz, Vazirlar Mahkamasi huzuridagi Davlat personallashtirish markazi, id.gov.uz orqali, bepul. YukSaroy 3 baza ro'yxatdan o'tkazadi: foydalanuvchilar (telefon, F.I.Sh., rol), haydovchilar (GPS trek — sezgir), mutaxassislar (guvohnoma).
- Qaror: hosting O'zbekistonda (UZINFOCOM/Uztelecom DC yoki taminot.d-railway.uz kabi lokal VPS). Nima uchun: davlat AJ bilan memorandumda "ma'lumotlar Respublikada" bandi so'raladi; GPS treklar jismoniy shaxsga tegishli. Alternativa: EU (adekvat) + SCC — faqat analitika nusxasi uchun.
- Rozilik: ro'yxatdan o'tishda alohida checkbox (oferta ichida yashirmaslik), haydovchi GPS — alohida rozilik, o'chirish huquqi (`DELETE /me`).

### 3.2 Elektron imzo (ZRU-793, 12.10.2022; 14.01.2023 dan)

- Yuridik kuch faqat **ERI**da (E-IMZO, STK NIC; sertifikat 24 oy; narx jismoniy 7% BHM, yuridik 10% BHM; my.gov.uz/OneID orqali onlayn). Mobil: "E-IMZO (ID karta)" ilovasi, e-imzo.soliq.uz bulutli kalit.
- Kimga majburiy: ESF, ETTYuX, e-nakl hujjatlari, GU-27/SMGS, stansiya xati. Oferta akseptini **SMS-OTP** bilan qilish mumkin (FK 370-m — harakat bilan aksept), lekin dalolatnoma/xat/shartnoma — ERI.
- Texnik: E-IMZO.js brauzer moduli (PKCS#7 attached), server tomonda imzo tekshiruvi (EIMZO API / `pkcs7 verify`). Alternativa: OneID login + "ERI keyinroq" — F1 uchun yetarli, F2da ERI majburiy.

### 3.3 To'lov agenti va eskrou (ZRU-578, 01.11.2019)

- To'lov xizmatlari — MB litsenziyasi; **to'lov agenti/subagenti** — bank yoki to'lov tashkiloti bilan agentlik shartnomasi orqali, litsenziyasiz; bank MBga agentlar ro'yxatini beradi.
- Konsepsiyadagi "mijoz tizimga to'laydi — tizim temir yo'lga to'laydi": platforma pulni **o'z hisobiga olmaydi**; to'lov tashkiloti (Payme/Click/Uzum Bank yoki bank) "split": mijoz → bank → (a) ELS/TexPD hisobi, (b) YukSaroy komissiya hisobi. Nima uchun: platforma hisobidagi tranzit pullar — soliq (aylanma/QQS bazasi) va MB nazorati xavfi.
- Eskrou: FKda alohida bob yo'q; 2024–2026 uy-joy uchun bank eskrou joriy etilmoqda (spot.uz, anhor.uz); amalda banklar "eskrou hisobi" xizmatini shartnoma asosida beradi (brb.uz). YukSaroy eskrousi = **bank eskrou hisobi + platforma "release" signali** (`escrow.status: HELD → RELEASED/REFUNDED`). Alternativa: "to'lov terminal tasdiqlagach" (post-pay) — eskrousiz, lekin no-show xavfi.

### 3.4 Rassrochka / BNPL (PP-294, 14.08.2026)

01.01.2027 dan: operatorlar MB ro'yxatida (banklar/MFO — uvedomlenie, qolganlar — ro'yxat), limit 250 BHM (110 mln so'm, 01.09.2026 holatiga), muddat ≤12 oy, ustama+jarima ≤50%/yil, muddatidan oldin to'lash jarimasiz, kredit byurosiga uzatish (3 BHMdan yuqori), muddati o'tgan qarz bo'lsa rad. Konsepsiyadagi 3/6/12 oy +4/8/14% — 50% ichida, lekin o'rtacha bitim 2,5 mln, vagon ijarasi/tarif 100+ mln bo'lishi mumkin — limitdan oshadi. Qaror: rassrochkani **bank/MFO hamkor** (masalan, TBC/Anor/Hamkor) beradi, YukSaroy — agent (skoring ma'lumoti: buyurtma tarixi). Alternativa: faktoring (terminalga tushumni bank sotib oladi) — MB ro'yxati talab qilmaydi, B2B uchun tabiiyroq.

### 3.5 Marketpleys javobgarligi («Elektron tijorat to'g'risida», 2022; 17.04.2025; Senat 18.05.2026)

- Operator — faqat O'zR rezident yuridik shaxsi; 01.07.2025 dan **uvedomlenie** (my.gov.uz); sotuvchi ma'lumotlarini tekshirish, maxfiylik, to'lov kiberxavfsizligi; sotuvchi talabni qondira olmasa — **subsidiar javobgarlik**; 2026 tahriri: platforma soliq agenti, sotuvchilarga alohida hisob raqami.
- YukSaroy uchun: oferta 3 ta: (1) Platforma–Mijoz, (2) Platforma–Xizmat ko'rsatuvchi (terminal/shahobcha/teplovoz/ekspeditor) — javobgarlik chegarasi, (3) Arbitraj reglamenti (3 ish kuni SLA). Terminal xizmatini platforma "o'z nomidan" sotmaydi (aks holda tashuvchi/ekspeditor javobgarligi) — faqat vositachi. Nima uchun: subsidiar javobgarlikni cheklash uchun sotuvchi verifikatsiyasi (STIR, litsenziya, ERI) majburiy bo'lishi kerak — bu "KYC qatlami" huquqiy talab, marketing emas.

### 3.6 Elektron hujjat aylanmasi

ESF — my.soliq.uz orqali majburiy; EDO operatorlari: Didox, Faktura.uz va boshqalar (bir nechtasini my.soliq.uz'da ko'rsatish shart). PKM-168 (18.03.2025) tovar-moddiy boyliklar tashish hujjatlari tartibini yangiladi; "gibrid ESF" (ESF + ETTYuX) ishlaydi. YukSaroy o'z EDO operatori bo'lmaydi — **Didox API** orqali dalolatnoma va ESF chiqaradi (`Order.done → act.pdf + ESF`). Alternativa: faqat PDF akt — buxgalteriya qabul qilmaydi.

### 3.7 Soliq

QQS 12% (2026); komissiya (agentlik haqi) QQSga tortiladi, tranzit summalar — yo'q (vositachilik, SK). Aylanma solig'i (1 mlrd so'mgacha) — MVP kompaniyasi uchun boshlang'ich rejim, lekin QQS to'lovchi terminallar QQS bilan ESF talab qiladi → 2-yildan QQS rejimi. 2026 dan marketpleyslar uchun stavkalar ko'tarildi (gazeta.uz, 31.12.2025) — aniq stavka soliq maslahatchisi bilan. "Stol uslug" — oddiy xizmat (12% QQS).

### 3.8 O'TY bilan hamkorlik shakllari

| Shakl | Asos | Qachon |
|---|---|---|
| Memorandum (majburiyatsiz) | — | F0: pilot stansiyalar, ma'lumot almashish niyati |
| Axborot almashinuv shartnomasi | ZRU-547, ZRU-1006 | F2: DAS UTY API |
| Agentlik shartnomasi (TexPD/MTU) | FK, ZRU-578 | "Stol uslug", ELS to'ldirish |
| GChSh / konsessiya | ZRU-537 (10.05.2019, 07.02.2025 tahr.), ZRU-1006 (obyektlar xususiy sektorga) | F3–F4: yuk saroyi boshqaruvi |
| Davlat xaridi (agar O'TY sotib olsa) | ZRU-684 (22.04.2021, ZRU-1070 23.06.2025) — davlat ulushi 50%+ AJ korporativ xarid, xarid.uzex.uz | tavsiya etilmaydi |

Qaror: YukSaroy O'TYga **sotilmaydi** — mustaqil operator, O'TY axborot hamkori. Nima uchun: davlat xaridi = tender, 6–12 oy, mahsulot O'TY mulkiga aylanadi. Alternativa: xususiy tashabbus GChSh (ZRU-537) — faqat yuk saroylarini boshqarishga o'tganda.

---

## 4. Xavf reestri

| # | Xavf | Ehtimol | Ta'sir | Yumshatish | Egasi |
|---|---|---|---|---|---|
| 1 | DAS UTY API bermaydi | Yuqori | Kuzatuv/ELS moduli qo'lda qoladi | L0+L3 bilan boshlash; memorandum; ETTYuX pretsedentiga tayanish | CEO |
| 2 | Oferta buzilishi (robot-login) | O'rta | Akkauntlar bloklanadi, obro' | L1 taqiq; kod-review qoidasi | CTO |
| 3 | Stansiya elektron xatni qabul qilmaydi | Yuqori | 1.8 modul ishlamaydi | ERI bilan PDF + qog'oz nusxa parallel; pilot DS bilan kelishuv | Ops |
| 4 | Xususiy teplovoz ruxsatsiz umumiy yo'lga chiqadi | O'rta | Hodisa, platforma javobgarligi | `locoPermitNo` verifikatsiyasi, e'londa "faqat noumumiy yo'l" | Compliance |
| 5 | Rassrochka = ro'yxatsiz operator (PP-294) | Yuqori | MB jarimasi, faoliyat to'xtashi | Bank/MFO hamkor; 01.01.2027 gacha o'z rassrochkasi yo'q | CFO |
| 6 | Platforma hisobida tranzit pul | O'rta | Soliq bazasi, MB nazorati | Split-payment, bank eskrou | CFO |
| 7 | 18 428 mijoz reyestrini ruxsatsiz ishlatish | Yuqori | O'TY bilan munosabat uziladi, ZRU-547 | O'TY yozma roziligi; opt-in; telefon bazasi yo'q — SMS baribir mumkin emas | CEO |
| 8 | GPS trek — jismoniy shaxs ma'lumoti | O'rta | Reyestr/rozilik buzilishi | Alohida rozilik, 30 kun saqlash, anonimlashtirish | DPO |
| 9 | Subsidiar javobgarlik (yuk shikastlandi) | O'rta | Da'vo platformaga | Oferta chegaralari, sug'urta hamkori, KYC | Legal |
| 10 | Tarif metodikasi o'zgaradi (2026–27) | Yuqori | Kalkulyator noto'g'ri | Tarif jadvali konfiguratsiyada, versiyalangan, `validFrom` | Product |
| 11 | Terminologik xato (GU-29 = nakladnoy) | Yuqori | Soha odamlari ishonmaydi | Glossariy, domen-review har relizda | Product |
| 12 | Demurraj taymeri GU-45 bilan mos kelmaydi | O'rta | Terminal–mijoz nizosi | Taymer GU-45 vaqtidan, sabab kodi | Product |
| 13 | SVX litsenziyasi muddati o'tgan | Past | Bojxona rad etadi | `certUntil` nazorati, avtomatik "faol emas" | Ops |
| 14 | ESF/EDO integratsiyasi yo'q | O'rta | Buxgalteriya qabul qilmaydi | Didox API F2 | CTO |
| 15 | E-tijorat uvedomleniesiz faoliyat | O'rta | Jarima | Ro'yxatdan o'tish ishga tushirishdan oldin | Legal |
| 16 | Shahobcha "ijarasi" yer huquqini buzadi | O'rta | Shartnoma haqiqiy emas | "Xizmat shartnomasi" shakli, O'TY tutashuv shartnomasi tekshiruvi | Legal |
| 17 | Vagon raqami/ESR validatsiyasiz xato hujjat | Yuqori | Stansiya rad etadi | Nazorat raqami validatorlari, ESR spravochnigi | CTO |
| 18 | O'TY reformasi (holding, yangi tarmoq) — kontragent o'zgaradi | O'rta | Shartnomalar qayta tuziladi | Shartnomalarda "huquqiy voris" bandi | Legal |

---

## 5. Ma'lumot manbalari va ularni qonuniy ishlatish

| Manba | Egasi | Huquqiy holat | Ishlatish |
|---|---|---|---|
| ESR stansiyalar (ЕСР с новыми станциями.xlsx; railway.uz 300+ jadval) | O'TY, ochiq nashr | ochiq ma'lumot | to'liq, `Station` seed |
| Tijorat operatsiya kodlari (1–12, K) | railway.uz | ochiq | terminal imkoniyatlari filtri |
| Шахобча йўллар.xlsx (№179 telegramma, 2026-08) | O'TY MTU'lar | ichki hujjat | faqat O'TY yozma roziligi bilan; VagonFlow `Siding.registryRef` orqali; egasi o'zi tasdiqlagach ommaviy |
| «Yagona darcha» 18 428 mijoz (STIR 18 338) | O'TY/DAS UTY | ma'lumotlar bazasi egasi — O'TY; STIR yuridik shaxs (shaxsiy emas), lekin baza — tijorat siri | O'TY roziligi + opt-in aktivatsiya; telefon yo'q — "Yagona darcha" orqali xabar (DAS UTY) |
| ETSNG klassifikatori | OSJD/O'TY | ochiq spravochnik | seed, yillik yangilash |
| Tarif preferensiyalari 2026 (railway.uz PDF) | O'TY | ochiq | kalkulyator "taxminiy" |
| STIR tekshiruvi | Soliq qo'mitasi (my.soliq.uz), orginfo.uz | ochiq/API | KYC avtomatik |
| Bojxona omborlari reyestri | Bojxona qo'mitasi | ochiq ro'yxat, API yo'q | qo'lda solishtirish |
| railmap JSON, OSM temir yo'l geometriyasi | o'zimizniki / ODbL | ochiq | xarita, attribution |
| pd.gov.uz reyestr | Personallashtirish markazi | majburiy ro'yxat | 3 baza |

---

## 6. Glossariy (40 atama)

| uz-Latn | uz-Cyrl | ru | en |
|---|---|---|---|
| Yuk saroyi | Юк саройи | Грузовой двор | Freight yard |
| Shahobcha yo'l | Шахобча йўл | Подъездной путь (необщего пользования) | Private siding |
| Umumiy foydalanish yo'li | Умумий фойдаланиш йўли | Путь общего пользования | Public track |
| Vagon qo'yish-olish | Вагон қўйиш-олиш | Подача-уборка вагонов | Wagon placement/removal |
| Manevr ishi | Маневр иши | Маневровая работа | Shunting |
| Talabnoma (GU-12) | Талабнома | Заявка ГУ-12 | Wagon request |
| Yuk xati (GU-27) | Юк хати | Накладная ГУ-27 | Consignment note |
| Yo'l vedomosti (GU-29) | Йўл ведомости | Дорожная ведомость | Waybill (road sheet) |
| Priyomosdatchik pamyatkasi (GU-45) | Приёмосдатчик памяткаси | Памятка приёмосдатчика | Placement memo |
| Qo'yish-olish vedomosti (GU-46) | Қўйиш-олиш ведомости | Ведомость подачи-уборки | Placement/removal sheet |
| SMGS yuk xati | СМГС юк хати | Накладная СМГС | SMGS consignment note |
| ETTYuX | ЭТТЮХ | ЭТТН | e-Waybill (tax) |
| ESF | ЭҲФ | ЭСФ | e-Invoice |
| ETSNG kodi | ЕТСНГ коди | Код ЕТСНГ | ETSNG cargo code |
| GNG kodi | ГНГ коди | Код ГНГ | GNG (harmonized) code |
| ESR kodi | ЕСР коди | Код ЕСР станции | Station code (ESR) |
| TY kod (yuk jo'natuvchi kodi) | ТЙ код | Код грузоотправителя | Shipper code |
| ELS | ЕЛС | Единый лицевой счёт | Unified personal account |
| TexPD | ТехПД | Технологический центр по обработке перевозочных документов | Document processing center |
| MTU | МТУ | Региональный узел (МТУ) | Regional node |
| DS | ДС | Начальник станции | Station master |
| DSP | ДСП | Дежурный по станции | Station duty officer |
| DNC | ДНЦ | Поездной диспетчер | Train dispatcher |
| Vagon egasi (SPS) | Вагон эгаси | Собственник (СПС) | Private wagon owner |
| Inventar park (MPS) | Инвентар парк | Инвентарный парк | Railway-owned fleet |
| Demurraj | Демурраж | Плата за пользование вагонами / простой | Demurrage |
| Tayм-slot | Тайм-слот | Временное окно | Time slot |
| ЕТП | ЕТП | Единый технологический процесс | Unified technological process |
| TRA | ТРА | Техническо-распорядительный акт станции | Station technical act |
| PTE | ПТЭ | Правила технической эксплуатации | Technical operation rules |
| Tormoz bashmog'i | Тормоз башмоғи | Тормозной башмак | Brake shoe |
| Tutashuv strelkasi | Туташув стрелкаси | Стрелка примыкания | Junction switch |
| Yuklash fronti | Юклаш фронти | Фронт погрузки | Loading front |
| SVX | СВХ | Склад временного хранения | Temporary storage warehouse |
| Bojxona ombori | Божхона омбори | Таможенный склад | Bonded warehouse |
| Vagon tarozisi | Вагон тарозиси | Вагонные весы | Rail weighbridge |
| Poverka | Поверка | Поверка средств измерений | Calibration/verification |
| ERI | ЭРИ | ЭЦП | Digital signature |
| Eskrou | Эскроу | Эскроу-счёт | Escrow |
| Ekspeditor | Экспедитор | Экспедитор | Freight forwarder |
| Deklarant | Декларант | Декларант | Customs declarant |
| Dislokatsiya | Дислокация | Дислокация вагона | Wagon location |

---

## Manbalar

- railway.uz — Yagona darcha (e-okno), Yuk tashish xizmatlari, stansiyalar jadvali (24483, 158, 20154), yangiliklar 34978
- e-nakl.railway.uz/Login/Oferta — DAS UTY ommaviy oferta
- buxgalter.uz — ETTYuX↔e-nakl integratsiyasi (text204213); ESF qo'llanma; PKM-168 (18.03.2025)
- lex.uz — ZRU-547, ZRU-578, ZRU-793, ZRU-701, ZRU-684, ZRU-1006 (7239400), PKM-72 (2612447), PKM-1028, PKM-447
- gazeta.uz — 27.03.2026 (ZRU-1125 shaxsiy ma'lumotlar), 29.11.2024 (temir yo'l qonuni), 17.08.2026 (PP-294 BNPL), 18.05.2026 (e-tijorat), 24.02.2026 (davlat xaridlari), 31.12.2025 (soliq 2026)
- spot.uz — 12.06.2026 (tariflar +5%, manevr 510 823 so'm), 21.08.2026 (tarif metodikasi), 19.05.2026 (e-tijorat Senat), 17.08.2026 (BNPL operatorlari), 30.09.2024 (eskrou)
- ebrd.com — 17.06.2026, €38,4 mln UTY raqamli transformatsiya
- zdmira.com — O'TY holding reformasi (24.10.2023 farmon)
- cit-rail.org — CIM/SMGS yuk xati qo'llanmasi 2025-12-12
- alta.ru — ETSNG spravochnigi
- norma.uz — to'lov tashkilotlari litsenziyalash; ERI qonuni; shaxsiy ma'lumotlar reyestri
- pd.gov.uz / my.gov.uz — shaxsiy ma'lumotlar bazalari reyestri
