/**
 * Namuna ma'lumotlar (sof quruvchilar, DB yo'q). Prodda katalog bo'sh ko'rinmasin deb
 * yuklanadi, lekin hech kimni aldamaydi: har qator isDemo=true, telefon yo'q, nomlar
 * "Namuna" yorlig'i bilan chiziladi. Id va slug'lar deterministik: qayta yuklash
 * yangi qator ochmaydi, o'chirish esa isDemo bo'yicha ketadi.
 *
 * Shakl asl formaga mos: e'lonlar validateListing dan o'tadi (spec tekshiradi).
 */
import {
  ORG_KIND_ROLES, REGIONS, type Condition, type ListingInput, type OrgKind, type PriceUnit, type RegionCode, type Role,
  type ServiceType, type TruckType, type WagonType,
} from '@yuksaroy/domain';

const pad = (n: number) => String(n).padStart(2, '0');
export const DEMO_ID = { org: (i: number) => `demo-org-${pad(i)}`, user: (i: number) => `demo-user-${pad(i)}`, listing: (i: number) => `demo-listing-${pad(i)}`, service: (i: number) => `demo-service-${pad(i)}`, request: (i: number) => `demo-request-${pad(i)}` };
/** Namuna telefonlar +998900000101.. : haqiqiy raqam bo'lishi mumkin emas (900 000 01xx seriyasi berilmagan). */
export const demoPhone = (i: number) => `+9989000001${pad(i)}`;
const som = (n: number) => n * 100;

/** Rasm majburiy (WAGON, SHUNTING_LOCO), lekin namuna uchun haqiqiy surat yo'q: oddiy, halol "Namuna rasm" plakati. */
export const demoPhoto = (label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#f3efe6"/><text x="320" y="190" font-family="sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="#002352">${label}</text><text x="320" y="232" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#7a7368">Namuna rasm</text></svg>`)}`;

// ───────────────────────── Tashkilotlar va odamlar ─────────────────────────

export interface DemoOrg { id: string; slug: string; name: string; kind: OrgKind; regionCode: RegionCode; description: string }
const ORG_ROWS: [string, OrgKind, RegionCode, string][] = [
  ['Nur Trans Logistika MChJ', 'CARRIER', 'UZ-TK', "Toshkentdan viloyatlarga tentli va refrijerator mashinalarda yuk tashiymiz. O'z parkimiz 18 ta mashina, haydovchilar shtatda."],
  ['Samarqand Yuk Tashish MChJ', 'CARRIER', 'UZ-SA', "Samarqand va Jizzax bo'ylab qurilish materiallari, don va meva tashish. Ag'daruvchi va tentli mashinalar."],
  ['Vodiy Avto Karvon MChJ', 'CARRIER', 'UZ-FA', "Farg'ona vodiysi ichida va Toshkentga muntazam reyslar. Konteyner tashuvchi platformalar ham bor."],
  ['Buxoro Trans Servis MChJ', 'CARRIER', 'UZ-BU', "Buxoro, Navoiy, Xorazm yo'nalishida sisterna va tentli mashinalar. Suyuq yuk uchun ruxsatnomalar mavjud."],
  ["Temir Yo'l Texnika Ijarasi MChJ", 'ASSET_OWNER', 'UZ-TK', "Yopiq vagon, yarim vagon va platformalarni oylik ijaraga beramiz. Texnik ko'rikdan o'tgan, hujjatlari tartibda."],
  ['Navoiy Vagon Servis MChJ', 'ASSET_OWNER', 'UZ-NW', "Xopper va yarim vagonlar, manevr teplovozlari. Navoiy tugunida o'z depomiz bor."],
  ['Qarshi Vagon Park MChJ', 'ASSET_OWNER', 'UZ-QA', "Sisterna va yopiq vagonlar sotuv va ijaraga. Qashqadaryo va Surxondaryo stansiyalarida turibdi."],
  ['Sharq Ekspeditsiya MChJ', 'FORWARDER', 'UZ-TK', "Temir yo'l va avto yuklarini boshidan oxirigacha kuzatamiz: vagon buyurtma, hujjat, kuzatuv."],
  ['Xorazm Yuk Ekspeditor MChJ', 'FORWARDER', 'UZ-XO', "Urganch va Xiva atrofidan eksport yuklarini jo'natish. Qozog'iston va Rossiya yo'nalishida tajriba."],
  ['Bojxona Hujjat Markazi MChJ', 'DECLARANT', 'UZ-TO', "Eksport-import deklaratsiyalari, sertifikat va kelib chiqish hujjatlari. Chirchiq va Angren postlari bilan ishlaymiz."],
  ['Andijon Deklarant Servis MChJ', 'DECLARANT', 'UZ-AN', "Vodiy korxonalari uchun bojxona rasmiylashtiruvi. Bir kunda tayyorlaymiz, kechikish bo'lsa xabar beramiz."],
  ['Jizzax Don Mahsulotlari MChJ', 'SHIPPER', 'UZ-JI', "Bug'doy, un va kepak ishlab chiqaramiz. Har oy 40-60 vagon yuk jo'natamiz, doimiy tashuvchi qidiramiz."],
];
export const DEMO_ORGS: DemoOrg[] = ORG_ROWS.map(([name, kind, regionCode, description], i) => ({
  id: DEMO_ID.org(i + 1),
  slug: `namuna-${name.toLowerCase().replace(/['`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`,
  name, kind, regionCode, description,
}));

export interface DemoUser { id: string; phone: string; fullName: string; orgId: string | null; roles: readonly Role[] }
const NAMES = [
  'Akmal Yusupov', 'Dilshod Rahimov', 'Bekzod Karimov', 'Sardor Tursunov', 'Jasur Abdullayev', 'Otabek Mirzayev',
  'Nodir Qodirov', 'Shahnoza Ergasheva', 'Farrux Saidov', 'Madina Nazarova', 'Ulug\'bek Toshpulatov', 'Sherzod Ismoilov',
  'Aziz Xolmatov', 'Kamola Yuldasheva', 'Bobur Sattorov', 'Nilufar Hakimova', 'Rustam Jalilov', 'Gulnora Olimova',
  'Doston Nurmatov', 'Zafar Boboyev', 'Muhammad Ali Umarov', 'Sevara Qosimova', 'Javohir Ortiqov', 'Feruza Mamatova',
  'Alisher Ganiyev', 'Iroda Sobirova', 'Elyor Xasanov', 'Dilnoza Ahmedova', 'Sanjar Rasulov', 'Mavluda Tojiyeva',
  'Behzod Qurbonov', 'Laylo Sharipova', 'Temur Egamberdiyev', 'Nargiza Abdurahmonova', 'Sirojiddin Haydarov',
  'Yulduz Norboyeva', 'Ravshan Mahmudov', 'Zilola Usmonova', 'Qahramon Berdiyev', 'Oydin Rustamova',
];
/** 1..12 tashkilot egalari, 13..40 yakka odamlar: xizmat ko'rsatuvchilar va yuk beruvchilar. */
export const DEMO_USERS: DemoUser[] = NAMES.map((fullName, i) => {
  const org = DEMO_ORGS[i] ?? null;
  return { id: DEMO_ID.user(i + 1), phone: demoPhone(i + 1), fullName, orgId: org?.id ?? null, roles: org ? ORG_KIND_ROLES[org.kind] : [] };
});

// ───────────────────────── E'lonlar ─────────────────────────

export interface DemoListing { id: string; slug: string; orgId: string; input: ListingInput }
const orgOf = (i: number) => DEMO_ORGS[i - 1].id;
const base: ListingInput = {
  kind: 'WAGON', deal: null, title: '', description: null, regionCode: 'UZ-TK', terminalId: null, priceTiyin: null, priceUnit: null, photos: [],
  year: null, condition: null, model: null, qty: 1, wagonType: null, capacityT: null, truckType: null, tonnage: null, fleetSize: null,
  serviceRegions: [], routes: [], contactPhone: null, responseHours: null,
};
const listing = (n: number, slug: string, orgIdx: number, input: Partial<ListingInput> & { kind: ListingInput['kind']; title: string }): DemoListing => ({
  id: DEMO_ID.listing(n), slug: `namuna-${slug}`, orgId: orgOf(orgIdx), input: { ...base, ...input },
});

type WagonRow = [string, string, WagonType, number, Condition, number, number, string, 'RENT' | 'SALE', number, RegionCode, number, string];
const WAGONS: WagonRow[] = [
  // title, slug, tur, yil, holat, soni, ko'tarish t, model, bitim, narx so'm, viloyat, org, tavsif
  ['Yopiq vagonlar ijaraga, 10 dona', 'yopiq-vagon-ijara-10', 'COVERED', 2012, 'GOOD', 10, 68, '11-280', 'RENT', 9_500_000, 'UZ-TK', 5, "Don, un va qadoqlangan yuk uchun yopiq vagonlar. Texnik ko'rik shu yil o'tgan, kamida 3 oyga beriladi."],
  ['Yarim vagonlar ijaraga, 20 dona', 'yarim-vagon-ijara-20', 'GONDOLA', 2015, 'GOOD', 20, 70, '12-132', 'RENT', 8_800_000, 'UZ-NW', 6, "Ko'mir, shag'al va metall uchun yarim vagonlar. Navoiy stansiyasida turibdi, bir kunda topshiramiz."],
  ['Platformalar konteyner uchun, 8 dona', 'platforma-konteyner-8', 'PLATFORM', 2010, 'GOOD', 8, 60, '13-4012', 'RENT', 7_200_000, 'UZ-TK', 5, "20 va 40 futlik konteyner qulflari bor. Chuqursoy va Sergeli yo'nalishida ishlagan."],
  ['Sisternalar sotuvga, 4 dona', 'sisterna-sotuv-4', 'TANK', 2008, 'NEEDS_REPAIR', 4, 60, '15-1443', 'SALE', 420_000_000, 'UZ-QA', 7, "Neft mahsulotlari uchun sisternalar. Ta'mir talab: qozon tekshiruvi kerak, narx shunga qarab qo'yilgan."],
  ['Xopper vagonlar sement uchun', 'xopper-sement-ijara', 'HOPPER', 2017, 'GOOD', 12, 70, '19-3116', 'RENT', 10_200_000, 'UZ-NW', 6, "Sement va mineral o'g'it uchun yopiq xopperlar. Pnevmatik tushirish, yuklash lyuklari ishlaydi."],
  ['Yopiq vagon sotuvga, 1 dona', 'yopiq-vagon-sotuv-1', 'COVERED', 2005, 'GOOD', 1, 66, '11-217', 'SALE', 180_000_000, 'UZ-QA', 7, "Bitta yopiq vagon, ombor sifatida ham ishlatsa bo'ladi. Hujjatlari to'liq, egasi tashkilot."],
  ['Refrijerator vagonlar meva uchun', 'refrijerator-meva-ijara', 'REFRIGERATOR', 2014, 'GOOD', 6, 50, 'ARV-E', 'RENT', 14_500_000, 'UZ-TK', 5, "Meva-sabzavot eksporti uchun sovutgichli vagonlar. Harorat -5 dan +14 gacha. Mavsumda oldindan band qiling."],
  ['Yarim vagonlar sotuvga, 5 dona', 'yarim-vagon-sotuv-5', 'GONDOLA', 2009, 'GOOD', 5, 69, '12-119', 'SALE', 210_000_000, 'UZ-NW', 6, "Ishlayotgan yarim vagonlar, oxirgi ta'mir 2024. Narx bitta vagon uchun emas, 5 tasi uchun jami."],
  ['Platformalar uzun yuk uchun', 'platforma-uzun-yuk-ijara', 'PLATFORM', 2013, 'GOOD', 6, 65, '13-401', 'RENT', 6_900_000, 'UZ-QA', 7, "Quvur, armatura va texnika tashish uchun platformalar. Mahkamlash uchun ko'zlar bor."],
  ['Sisternalar suyuq yuk ijaraga', 'sisterna-suyuq-ijara', 'TANK', 2016, 'GOOD', 3, 60, '15-1547', 'RENT', 12_000_000, 'UZ-TK', 5, "O'simlik moyi va shakar siropi uchun toza sisternalar. Har reysdan keyin yuviladi, dalolatnoma beriladi."],
];

type TruckRow = [string, string, TruckType, number, number, RegionCode, RegionCode[], [RegionCode, RegionCode][], PriceUnit, number, number, string];
const TRUCKS: TruckRow[] = [
  // title, slug, kuzov, tonnaj, park, viloyat, hududlar, yo'nalishlar, narx birligi, narx so'm, org, tavsif
  ['Tentli fura 20 t, Toshkent-Farg\'ona', 'tentli-fura-toshkent-fargona', 'TENT', 20, 6, 'UZ-TK', ['UZ-TK', 'UZ-TO', 'UZ-FA', 'UZ-AN', 'UZ-NG'], [['UZ-TK', 'UZ-FA'], ['UZ-TK', 'UZ-AN']], 'PER_TRIP', 3_200_000, 1, "Vodiyga har kuni jo'naymiz, yo'lda 8-9 soat. Yuk sug'urtasi bor, haydovchilar tajribali."],
  ['Refrijerator 18 t, meva eksporti', 'refrijerator-18t-meva', 'REF', 18, 4, 'UZ-TK', ['UZ-TK', 'UZ-SA', 'UZ-BU', 'UZ-XO'], [['UZ-TK', 'UZ-XO']], 'PER_KM', 9_500, 1, "Sovutgichli mashinalar, harorat yozuvi bilan. Meva, go'sht va sut mahsulotlari uchun."],
  ['Ag\'daruvchi 25 t, qurilish yuklari', 'agdaruvchi-25t-qurilish', 'TIPPER', 25, 5, 'UZ-SA', ['UZ-SA', 'UZ-JI', 'UZ-SI'], [['UZ-SA', 'UZ-JI']], 'PER_TON', 45_000, 2, "Shag'al, qum, tuproq tashiymiz. Karer va qurilish maydonlariga kirish bor."],
  ['Tentli 20 t, Samarqand-Toshkent', 'tentli-20t-samarqand-toshkent', 'TENT', 20, 3, 'UZ-SA', ['UZ-SA', 'UZ-TK', 'UZ-TO'], [['UZ-SA', 'UZ-TK']], 'PER_TRIP', 2_600_000, 2, "Har hafta 3-4 reys, qaytishda ham yuk olamiz. Yuk ortish va tushirishga yordam beramiz."],
  ['Konteyner tashuvchi, 40 fut', 'konteyner-tashuvchi-40-fut', 'CONTAINER', 26, 4, 'UZ-FA', ['UZ-FA', 'UZ-AN', 'UZ-NG', 'UZ-TK'], [['UZ-FA', 'UZ-TK']], 'PER_TRIP', 3_800_000, 3, "Konteyner terminalidan olib, korxonaga yetkazamiz. 20 va 40 futlik konteynerlar."],
  ['Tentli 10 t, vodiy ichida', 'tentli-10t-vodiy', 'TENT', 10, 8, 'UZ-FA', ['UZ-FA', 'UZ-AN', 'UZ-NG'], [['UZ-FA', 'UZ-AN'], ['UZ-FA', 'UZ-NG']], 'PER_KM', 6_000, 3, "Kichik partiyalar uchun 10 tonnalik mashinalar. Shahar ichi va vodiy bo'ylab bir kunda."],
  ['Sisterna 22 t, suyuq yuk', 'sisterna-22t-suyuq', 'TANK', 22, 3, 'UZ-BU', ['UZ-BU', 'UZ-NW', 'UZ-XO', 'UZ-QR'], [['UZ-BU', 'UZ-XO']], 'PER_KM', 8_200, 4, "Oziq-ovqat va texnik suyuqliklar uchun alohida sisternalar. Ruxsatnoma va yuvish dalolatnomasi beriladi."],
  ['Tentli 20 t, Buxoro-Toshkent', 'tentli-20t-buxoro-toshkent', 'TENT', 20, 5, 'UZ-BU', ['UZ-BU', 'UZ-NW', 'UZ-SA', 'UZ-TK'], [['UZ-BU', 'UZ-TK']], 'PER_TRIP', 4_100_000, 4, "Buxorodan Toshkentga haftada ikki marta, yo'lda Navoiy va Samarqandda yuk olamiz."],
  ['Ochiq platforma 20 t, texnika tashish', 'ochiq-platforma-20t-texnika', 'FLATBED', 20, 2, 'UZ-TK', ['UZ-TK', 'UZ-TO', 'UZ-SI', 'UZ-JI'], [['UZ-TK', 'UZ-JI']], 'PER_KM', 7_500, 1, "Traktor, generator va uskunalar tashiymiz. Yuklash uchun trap va mahkamlash tasmalari bor."],
  ['Ag\'daruvchi 15 t, Jizzax', 'agdaruvchi-15t-jizzax', 'TIPPER', 15, 4, 'UZ-SA', ['UZ-SA', 'UZ-JI'], [['UZ-SA', 'UZ-JI']], 'PER_TON', 38_000, 2, "Jizzax va Samarqand qurilishlariga qum va shag'al. Kichik ko'chalarga ham kiradi."],
];

type LocoRow = [string, string, number, Condition, string, number, 'RENT' | 'SALE', number, RegionCode, number, number, string];
const LOCOS: LocoRow[] = [
  // title, slug, yil, holat, model, ko'tarish t (tortish), bitim, narx so'm, viloyat, javob soati, org, tavsif
  ['Manevr teplovozi TEM2 ijaraga', 'manevr-teplovozi-tem2-ijara', 2007, 'GOOD', 'TEM2', 1200, 'RENT', 95_000_000, 'UZ-TK', 4, 5, "Zavod shahobcha yo'lida manevr uchun. Mashinist bilan yoki mashinistsiz, kelishiladi."],
  ['Manevr teplovozi TGM4 sotuvga', 'manevr-teplovozi-tgm4-sotuv', 1998, 'NEEDS_REPAIR', 'TGM4', 800, 'SALE', 1_900_000_000, 'UZ-NW', 24, 6, "Dvigatel kapital ta'mir talab qiladi, ramasi va g'ildiraklari yaxshi. Ko'rib olish mumkin."],
  ['Manevr teplovozi TGM6 ijaraga', 'manevr-teplovozi-tgm6-ijara', 2011, 'GOOD', 'TGM6', 1000, 'RENT', 110_000_000, 'UZ-QA', 6, 7, "Qarshi tugunida turibdi. Soatlik emas, oylik ijara, yoqilg'i buyurtmachidan."],
  ['Manevr teplovozi TEM18 ijaraga', 'manevr-teplovozi-tem18-ijara', 2015, 'GOOD', 'TEM18DM', 1300, 'RENT', 140_000_000, 'UZ-NW', 8, 6, "Yangi avlod teplovoz, kam yoqilg'i sarflaydi. Navoiy va Buxoro shahobchalariga chiqamiz."],
  ['Manevr teplovozi TGK2 sotuvga', 'manevr-teplovozi-tgk2-sotuv', 2003, 'GOOD', 'TGK2', 400, 'SALE', 650_000_000, 'UZ-TK', 12, 5, "Kichik shahobcha va ombor yo'llari uchun yengil teplovoz. Ishlayotgan holatda, hujjatlari tartibda."],
];

export const DEMO_LISTINGS: DemoListing[] = [
  ...WAGONS.map(([title, slug, wagonType, year, condition, qty, capacityT, model, deal, price, regionCode, org, description], i) =>
    listing(i + 1, slug, org, { kind: 'WAGON', deal, title, description, regionCode, wagonType, year, condition, qty, capacityT, model,
      priceTiyin: som(price), priceUnit: deal === 'RENT' ? 'PER_MONTH' : 'TOTAL', photos: [demoPhoto(title)] })),
  ...TRUCKS.map(([title, slug, truckType, tonnage, fleetSize, regionCode, serviceRegions, routes, priceUnit, price, org, description], i) =>
    listing(WAGONS.length + i + 1, slug, org, { kind: 'TRUCK', deal: null, title, description, regionCode, truckType, tonnage, fleetSize, serviceRegions,
      routes: routes.map(([from, to]) => ({ from, to })), priceTiyin: som(price), priceUnit, responseHours: 2 })),
  ...LOCOS.map(([title, slug, year, condition, model, capacityT, deal, price, regionCode, responseHours, org, description], i) =>
    listing(WAGONS.length + TRUCKS.length + i + 1, slug, org, { kind: 'SHUNTING_LOCO', deal, title, description, regionCode, year, condition, model, capacityT,
      priceTiyin: som(price), priceUnit: deal === 'RENT' ? 'PER_MONTH' : 'TOTAL', responseHours, photos: [demoPhoto(title)] })),
];

// ───────────────────────── Xizmatlar markazi ─────────────────────────

export interface DemoService { id: string; userId: string; orgId: string | null; serviceType: ServiceType; title: string; description: string; regions: RegionCode[]; experienceYears: number; priceNote: string }
type ServiceRow = [string, RegionCode[], number, string, string];
const SERVICE_ROWS: Record<ServiceType, ServiceRow[]> = {
  FORWARDER: [
    ["Vagon buyurtma va yuk kuzatuvi, Toshkent tuguni", ['UZ-TK', 'UZ-TO'], 9, "kelishiladi, yuk hajmiga qarab", "Vagon so'rovidan yuk yetib borguncha bitta odam javob beradi. Har kuni vagon qayerdaligini xabar qilamiz. Don, un, qurilish materiallari bilan ko'p ishlaganmiz."],
    ["Eksport yuklarini Qozog'iston va Rossiyaga jo'natish", ['UZ-XO', 'UZ-QR'], 12, "1 vagon uchun 1 200 000 so'mdan", "Meva-sabzavot eksporti mavsumida har kuni 5-10 vagon jo'natamiz. Chegara stansiyalarida o'z odamlarimiz bor. Hujjat va kuzatuv bir paketda."],
    ["Konteyner yuklari, Chuqursoy va Angren", ['UZ-TK', 'UZ-TO', 'UZ-FA'], 6, "1 konteyner uchun 900 000 so'm", "Konteynerni terminaldan olib, vagonga yuklash va manzilga yetkazishni tashkil qilamiz. Xitoy va Koreya yo'nalishida tajriba bor."],
    ["Vodiy korxonalari uchun ekspeditor", ['UZ-FA', 'UZ-AN', 'UZ-NG'], 7, "kelishiladi", "Farg'ona vodiysidagi zavodlar uchun xom ashyo keltirish va tayyor mahsulot jo'natish. Vagon topish qiyin paytlarda ham yechim topamiz."],
    ["Samarqand va Jizzax, don va o'g'it yuklari", ['UZ-SA', 'UZ-JI'], 10, "1 tonna uchun 25 000 so'mdan", "Don va mineral o'g'itlarni vagonda jo'natish. Elevator va omborlar bilan bevosita aloqa. Vagon ostida turish vaqtini kamaytiramiz."],
    ["Buxoro va Navoiy, sanoat yuklari", ['UZ-BU', 'UZ-NW'], 8, "kelishiladi", "Sement, metall va kimyo mahsulotlari bo'yicha ekspeditsiya. Yarim vagon va xopper buyurtma qilamiz, yuklashni nazorat qilamiz."],
    ["Qashqadaryo, Surxondaryo, janub yo'nalishi", ['UZ-QA', 'UZ-SU'], 5, "1 vagon uchun 800 000 so'mdan", "Janubdan Toshkentga va shimolga yuk jo'natish. Termiz orqali Afg'oniston yo'nalishida ham ishlaymiz."],
    ["Avto va temir yo'l aralash tashuv", ['UZ-TK', 'UZ-SI', 'UZ-JI'], 11, "kelishiladi", "Yukni avtoda stansiyaga keltirib, vagonga yuklab, manzilda yana avto bilan yetkazamiz. Bir shartnoma, bir javobgar."],
    ["Kichik partiyalar, yig'ma vagon", ['UZ-TK', 'UZ-TO'], 4, "1 tonna uchun 40 000 so'mdan", "Bir vagonga yetmaydigan yuklarni boshqalar bilan birga jo'natamiz. Haftada ikki marta Toshkentdan vodiyga va Samarqandga."],
    ["Xorazm, paxta va tekstil yuklari", ['UZ-XO', 'UZ-BU'], 14, "kelishiladi", "Paxta tolasi va tayyor to'qimachilik mahsulotlarini eksportga jo'natish. Bojxona hujjatlari ham bir joyda."],
  ],
  CASHIER: [
    ["Tovar kassiri, Toshkent-tovar stansiyasi", ['UZ-TK'], 15, "1 hujjat 150 000 so'm", "Yuk xati va vagon hujjatlarini to'ldirib, stansiyada topshiraman. Xato tufayli vagon turib qolmasligi uchun avval tekshirib chiqaman."],
    ["Tovar kassiri, Sergeli va Chuqursoy", ['UZ-TK', 'UZ-TO'], 8, "1 vagon 120 000 so'm", "Kunlik ish: yuk xati, hisob-kitob varaqasi, tarif hisoblash. Ertalab topshirsangiz kechgacha tayyor."],
    ["Tovar kassiri, Samarqand stansiyasi", ['UZ-SA'], 11, "kelishiladi", "Samarqand va Kattaqo'rg'on stansiyalarida yuk hujjatlarini rasmiylashtiraman. Tarif hisobida xato bo'lmaydi."],
    ["Tovar kassiri, Andijon va Asaka", ['UZ-AN'], 6, "1 hujjat 130 000 so'm", "Vodiydan jo'nayotgan vagonlar uchun hujjat to'plami. Eksport yuklarida bojxona bilan kelishib ishlayman."],
    ["Tovar kassiri, Navoiy tuguni", ['UZ-NW'], 9, "1 vagon 110 000 so'm", "Sanoat yuklari: sement, metall, kimyo. Ko'p vagonli jo'natmalarda chegirma bor."],
    ["Tovar kassiri, Buxoro va Qorako'l", ['UZ-BU'], 7, "kelishiladi", "Yuk xati, plomba dalolatnomasi, og'irlik hujjatlari. Kechqurun ham telefonda javob beraman."],
    ["Tovar kassiri, Qarshi stansiyasi", ['UZ-QA'], 10, "1 hujjat 120 000 so'm", "Qashqadaryodan don va g'isht jo'natmalari bo'yicha tajriba katta. Hujjat qaytib kelsa o'zim to'g'irlab beraman."],
    ["Tovar kassiri, Urganch", ['UZ-XO', 'UZ-QR'], 12, "kelishiladi", "Xorazm va Qoraqalpog'iston stansiyalarida eksport yuklarini rasmiylashtiraman. Meva mavsumida oldindan yozib qo'ying."],
    ["Tovar kassiri, Jizzax va Guliston", ['UZ-JI', 'UZ-SI'], 5, "1 vagon 100 000 so'm", "Don va un yuklari bo'yicha hujjatlar. Elevatorga o'zim borib, joyida to'ldiraman."],
    ["Tovar kassiri, Termiz", ['UZ-SU'], 13, "1 hujjat 160 000 so'm", "Termiz chegara stansiyasida tranzit va eksport hujjatlari. Afg'oniston yo'nalishida alohida tajriba."],
  ],
  DOCS: [
    ["Bojxona deklaratsiyasi, eksport va import", ['UZ-TK', 'UZ-TO'], 10, "1 deklaratsiya 350 000 so'mdan", "Eksport-import deklaratsiyalarini bir kunda tayyorlaymiz. Kod tanlashda xato bo'lmasligi uchun tovarni oldin ko'rib chiqamiz."],
    ["Kelib chiqish sertifikati va ruxsatnomalar", ['UZ-TK'], 7, "kelishiladi", "Sertifikat, fitosanitar va veterinariya ruxsatnomalarini olib beramiz. Qaysi hujjat kerakligini tovar bo'yicha aytamiz."],
    ["Vodiy uchun bojxona hujjatlari", ['UZ-FA', 'UZ-AN', 'UZ-NG'], 9, "1 deklaratsiya 300 000 so'm", "Andijon va Farg'ona postlarida rasmiylashtiruv. Korxonaga borib, hujjat yig'ib ketamiz."],
    ["Shartnoma va yuk hujjatlari to'plami", ['UZ-SA', 'UZ-JI'], 6, "1 to'plam 250 000 so'm", "Tashuv shartnomasi, yuk xati, invoys va o'ram ro'yxatini bir shakl bo'yicha tayyorlaymiz. Bankka ham topshirishga yaraydi."],
    ["Eksport hujjatlari, meva-sabzavot", ['UZ-XO', 'UZ-BU', 'UZ-QR'], 11, "kelishiladi", "Meva-sabzavot eksporti uchun to'liq hujjat: deklaratsiya, fitosanitar, sifat sertifikati. Mavsumda kechasi ham ishlaymiz."],
    ["Import rasmiylashtiruvi, uskunalar", ['UZ-TK', 'UZ-SI'], 8, "1 deklaratsiya 400 000 so'mdan", "Xitoy va Turkiyadan keladigan uskunalar uchun import hujjatlari. Imtiyoz kodlarini bilamiz, ortiqcha to'lamaysiz."],
    ["Bojxona hujjatlari, Navoiy va Buxoro", ['UZ-NW', 'UZ-BU'], 5, "kelishiladi", "Sanoat korxonalari uchun doimiy xizmat: oyiga bir to'lov, hujjat soni cheklanmagan."],
    ["Tranzit hujjatlari, Termiz", ['UZ-SU', 'UZ-QA'], 12, "1 hujjat 380 000 so'm", "Afg'oniston va Pokiston yo'nalishida tranzit rasmiylashtiruvi. Chegara postida o'z vakilimiz bor."],
    ["Temir yo'l yuk hujjatlari, maslahat", ['UZ-TK', 'UZ-TO', 'UZ-SA'], 14, "1 soat maslahat 200 000 so'm", "Birinchi marta vagon jo'natayotganlar uchun: qaysi hujjat, qayerga, qachon. Hujjatni o'zingiz to'ldirasiz, biz tekshiramiz."],
    ["Sertifikatlash va markirovka", ['UZ-AN', 'UZ-FA'], 6, "kelishiladi", "Majburiy sertifikat va markirovka hujjatlarini olib beramiz. Eksportga chiqayotgan kichik korxonalar uchun qulay."],
  ],
};
/** Profil egalari: ekspeditor va deklarant tashkilot egalari o'z turida, qolgani yakka odamlar. Tashkilot egasida orgId ham bor. */
const SERVICE_OWNERS: Record<ServiceType, number[]> = {
  FORWARDER: [8, 9, 13, 14, 15, 16, 17, 18, 19, 20],
  CASHIER: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  DOCS: [10, 11, 31, 32, 33, 34, 35, 36, 37, 38],
};
export const DEMO_SERVICES: DemoService[] = (['FORWARDER', 'CASHIER', 'DOCS'] as const).flatMap((serviceType, t) =>
  SERVICE_ROWS[serviceType].map(([title, regions, experienceYears, priceNote, description], i) => {
    const user = DEMO_USERS[SERVICE_OWNERS[serviceType][i] - 1];
    return { id: DEMO_ID.service(t * 10 + i + 1), userId: user.id, orgId: user.orgId, serviceType, title, description, regions, experienceYears, priceNote };
  }));

// ───────────────────────── Bozor so'rovlari ─────────────────────────

export interface DemoRequest {
  id: string; board: 'CARGO' | 'SERVICE'; createdById: string; orgId: string | null; title: string; description: string;
  serviceType: ServiceType | null; regionCode: RegionCode; fromRegion: RegionCode | null; toRegion: RegionCode | null; fromText: string | null; toText: string | null;
  cargoName: string | null; weightT: number | null; truckType: TruckType | null; loadInDays: number | null;
}
type CargoRow = [RegionCode, RegionCode, string, string, string, number, TruckType, number, number, string];
const CARGO_ROWS: CargoRow[] = [
  // dan, ga, dan matn, ga matn, yuk, tonna, kuzov, necha kundan keyin, egasi user, tavsif
  ['UZ-JI', 'UZ-TK', "Jizzax, don ombori", "Toshkent, Sergeli", "Bug'doy uni, qopda", 20, 'TENT', 2, 12, "Qopda 20 tonna un. Yuklash ertalab, ombor yuklovchisi bor. Toshkentda tushirish bir joyda."],
  ['UZ-FA', 'UZ-TK', "Marg'ilon, fabrika", "Toshkent, Yashnobod", "Tayyor gazlama, rulonda", 12, 'TENT', 3, 39, "Rulonlar nam bo'lmasligi kerak, tent butun bo'lsin. Yuklash 2 soat."],
  ['UZ-SA', 'UZ-XO', "Samarqand, sovutgich ombori", "Urganch", "Olma, yashikda", 16, 'REF', 1, 40, "Harorat +2 dan +4 gacha. Kechasi yo'lga chiqsa yaxshi, ertalab Urganchda bo'lsin."],
  ['UZ-TK', 'UZ-BU', "Toshkent, Chuqursoy", "Buxoro, sanoat zonasi", "Uskuna, 2 ta konteyner 20 fut", 24, 'CONTAINER', 5, 8, "Ikki konteyner, bitta mashinaga sig'adi. Terminalda yuklash navbati bor, oldindan kelish kerak."],
  ['UZ-NW', 'UZ-SA', "Navoiy, karer", "Samarqand, qurilish", "Shag'al", 25, 'TIPPER', 1, 9, "Har kuni 4-5 reys, bir hafta davomida. Bir mashina emas, bir nechta kerak."],
  ['UZ-AN', 'UZ-TK', "Andijon, avtozavod hududi", "Toshkent, Yangihayot", "Avto ehtiyot qismlar, palletda", 8, 'TENT', 4, 12, "22 pallet, ehtiyot qismlar. Yuk qimmat, sug'urta bo'lsa afzal."],
  ['UZ-QA', 'UZ-TK', "Qarshi", "Toshkent, Qo'yliq", "Kartoshka, qopda", 20, 'TENT', 2, 39, "Bozorga ertalab yetib borishi kerak. Yuklash kechqurun, dalada."],
  ['UZ-BU', 'UZ-NW', "Buxoro, moy zavodi", "Navoiy", "Paxta moyi", 20, 'TANK', 6, 40, "Oziq-ovqat sisternasi kerak, yuvilgan va dalolatnomasi bilan. Ikki reys."],
  ['UZ-TK', 'UZ-SU', "Toshkent, Sergeli", "Termiz", "Qurilish texnikasi, ekskavator", 18, 'FLATBED', 7, 8, "Bitta ekskavator, o'zi chiqadi. Balandligi 3,2 metr, yo'lda ko'prik bor-yo'qligini tekshiring."],
  ['UZ-XO', 'UZ-TK', "Xiva", "Toshkent, Chilonzor", "Qovun, yashikda", 14, 'REF', 3, 12, "Mavsum yuki, 3 kun ichida jo'nashi kerak. Sovutgich +8 atrofida."],
];
type ServiceReqRow = [ServiceType, RegionCode, string, number, string];
const SERVICE_REQ_ROWS: ServiceReqRow[] = [
  // xizmat turi, viloyat, sarlavha, egasi user, tavsif
  ['FORWARDER', 'UZ-JI', "Har oy 40 vagon un jo'natishga ekspeditor kerak", 12, "Jizzaxdan Toshkent va Farg'onaga. Vagon buyurtma va kuzatuvni to'liq topshirmoqchimiz, oylik shartnoma."],
  ['CASHIER', 'UZ-TK', "Toshkent-tovar uchun tovar kassiri, doimiy", 1, "Haftada 10-15 vagon jo'natamiz, hujjatlarni o'zimiz to'ldirishga ulgurmayapmiz. Doimiy odam kerak."],
  ['DOCS', 'UZ-FA', "Birinchi eksport: Qozog'istonga meva, hujjat kerak", 2, "Ilgari eksport qilmaganmiz. Qaysi hujjat kerak, qancha vaqt ketadi, shuni tushuntirib, tayyorlab bersa."],
  ['FORWARDER', 'UZ-XO', "Meva mavsumida 5 vagon kunlik jo'natma", 9, "Iyul-avgustda har kuni 3-5 refrijerator vagon. Vagon topish va chegara hujjatlari bilan yordam kerak."],
  ['DOCS', 'UZ-TK', "Xitoydan uskuna importi, deklaratsiya", 3, "Ikki konteyner uskuna keladi. Import deklaratsiyasi va imtiyoz kodlari bo'yicha mutaxassis kerak."],
  ['CASHIER', 'UZ-SA', "Samarqand stansiyasida 20 vagon uchun hujjat", 4, "Bir martalik ish: 20 yarim vagon shag'al jo'natiladi, yuk xatlari va tarif hisobini to'ldirish kerak."],
  ['FORWARDER', 'UZ-NW', "Sement jo'natish, xopper vagon topish", 5, "Oyiga 30 xopper. Vagon topish qiyin, kim doimiy yechim bera oladi?"],
  ['DOCS', 'UZ-AN', "Tekstil eksporti, sertifikat va deklaratsiya", 6, "Turkiyaga gazlama eksporti. Kelib chiqish sertifikati va deklaratsiya bir joyda bo'lsa yaxshi."],
  ['CASHIER', 'UZ-SU', "Termizda tranzit vagonlar uchun kassir", 7, "Afg'onistonga tranzit, haftada 6-8 vagon. Chegara stansiyasida tajribasi bor odam kerak."],
  ['FORWARDER', 'UZ-TK', "Kichik partiya, yig'ma vagon Farg'onaga", 40, "3 tonna yuk, vagonga yetmaydi. Kim yig'ma vagon bilan Farg'onaga jo'natadi?"],
];
export const DEMO_REQUESTS: DemoRequest[] = [
  ...CARGO_ROWS.map(([fromRegion, toRegion, fromText, toText, cargoName, weightT, truckType, loadInDays, user, description], i): DemoRequest => ({
    id: DEMO_ID.request(i + 1), board: 'CARGO', createdById: DEMO_ID.user(user), orgId: DEMO_USERS[user - 1].orgId,
    title: `${cargoName}, ${weightT} t`, description, serviceType: null, regionCode: fromRegion, fromRegion, toRegion, fromText, toText, cargoName, weightT, truckType, loadInDays,
  })),
  ...SERVICE_REQ_ROWS.map(([serviceType, regionCode, title, user, description], i): DemoRequest => ({
    id: DEMO_ID.request(CARGO_ROWS.length + i + 1), board: 'SERVICE', createdById: DEMO_ID.user(user), orgId: DEMO_USERS[user - 1].orgId,
    title, description, serviceType, regionCode, fromRegion: null, toRegion: null, fromText: null, toText: null, cargoName: null, weightT: null, truckType: null, loadInDays: null,
  })),
];

/** Spec uchun: hamma viloyat kodi haqiqiy ro'yxatdan. */
export const isRegion = (r: string): r is RegionCode => (REGIONS as readonly string[]).includes(r);
