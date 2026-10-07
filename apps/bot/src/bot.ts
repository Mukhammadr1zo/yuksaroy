// YukSaroy Telegram bot: terminal qidiruvi (API /search/parse orqali) va kirish (OTP) kanali.
// Buyruqlar ro'yxati BotFather'da emas, bot ishga tushganda kodda o'rnatiladi (pastda CMD_DESC).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Context, Markup, Telegraf } from 'telegraf';
import { z } from 'zod';

// Monorepo ildizidagi .env (dotenv'siz, Node 21.7+). Bor muhit o'zgaruvchilari ustun turadi.
for (const p of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env'), resolve(__dirname, '../../../.env')]) {
  if (existsSync(p)) { process.loadEnvFile(p); break; }
}

const env = z.object({
  BOT_TOKEN: z.string().min(10),
  API_URL: z.string().url().default('http://localhost:4000'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  TG_APP_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()), // Mini App manzili, sukut WEB_URL + /tg; bo'sh = yo'q
  INTERNAL_SECRET: z.string().min(16),
}).parse(process.env);

// Telegram faqat OMMAVIY https havolani qabul qiladi (web_app tugma ham, url tugma ham):
// localhost yoki ichki manzil bo'lsa tugma umuman qo'yilmaydi, aks holda butun xabar
// "Wrong HTTP URL" bilan yuborilmay qoladi va foydalanuvchi hech nima ko'rmaydi.
const APP_URL = env.TG_APP_URL ?? `${env.WEB_URL}/tg`;
const publicHttps = (u: string) => /^https:\/\//.test(u) && !/localhost|127\.0\.0\.1|\.local(?::|\/|$)/.test(u);
const WEB_APP = publicHttps(APP_URL);
const PUBLIC_LINK = publicHttps(env.WEB_URL);
if (!WEB_APP) console.warn(`bot: ${APP_URL} https emas, web_app o'rniga url tugmalar ishlatiladi`);
if (!PUBLIC_LINK) console.warn(`bot: ${env.WEB_URL} ommaviy https emas, xabarlarda havola tugmalari qo'yilmaydi`);

const bot = new Telegraf(env.BOT_TOKEN);
const pendingToken = new Map<number, string>(); // chatId -> login token (/start login_<token>)

/**
 * API chaqiruvi, 10 s timeout. Tarmoq xatosi chaqiruvchida ushlanadi.
 *
 * content-type faqat tana bo'lganda: Fastify tanasi bo'sh JSON so'rovini 400 bilan
 * rad etadi va bu guardlargacha ham yetib bormaydi. Hozir bot DELETE chaqirmaydi,
 * lekin keyin qo'shilsa shu tuzoqqa tushmasin (web tomonda aynan shu xato bo'lgan).
 */
const api = (path: string, init?: RequestInit & { headers?: Record<string, string> }) =>
  fetch(`${env.API_URL}/v1${path}`, {
    ...init,
    headers: { ...(init?.body == null ? {} : { 'content-type': 'application/json' }), ...init?.headers },
    signal: AbortSignal.timeout(10_000),
  });

type Lang = 'uz' | 'ru' | 'en';
const langOf = (code?: string): Lang => (code?.startsWith('ru') ? 'ru' : code?.startsWith('en') ? 'en' : 'uz');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Qidiruv matnlari ──

type Chip = { key: string; type: string; value: string };
type ParseRes = {
  filters: { confidence: number };
  chips: Chip[];
  query: Record<string, string>;
  decision: { terminals: number; freeToday: number; cheapestTiyin: number | null; cheapestUnit: string | null; nearestKm: number | null };
};
type Card = { slug: string; name: string; kind: string; regionCode: string | null; fromPriceTiyin: number | null; freeToday?: number; isDemo?: boolean };

// Chip va karta yorliqlari: domain SEARCH_LABELS nusxasi, bot domain paketiga bog'lanmaydi.
// ponytail: yorliqlar takrorlangan, API chip.label qaytarsa shu jadval o'chadi
const LABELS: Record<Lang, Record<string, Record<string, string>>> = {
  uz: {
    region: {
      'UZ-TK': 'Toshkent', 'UZ-TO': 'Toshkent vil.', 'UZ-SI': 'Sirdaryo', 'UZ-JI': 'Jizzax', 'UZ-SA': 'Samarqand', 'UZ-BU': 'Buxoro', 'UZ-NW': 'Navoiy',
      'UZ-QA': 'Qashqadaryo', 'UZ-SU': 'Surxondaryo', 'UZ-XO': 'Xorazm', 'UZ-QR': "Qoraqalpog'iston", 'UZ-AN': 'Andijon', 'UZ-NG': 'Namangan', 'UZ-FA': "Farg'ona",
    },
    service: { LOAD: 'Yuklash', UNLOAD: 'Tushirish', WEIGH: 'Tarozi', STORAGE: 'Saqlash', SVX: 'Bojxona ombori', CONTAINER: 'Konteyner', LAST_MILE: 'Avtoda yetkazish', SHUNTING: 'Manevr' },
    kind: { RAIL: "Temir yo'l yuk terminali", ROAD: 'Avto yuk terminali', MULTI: "Avto va temir yo'l terminali" },
    category: { terminal: 'Terminal', equipment: "Temir yo'l texnikasi", truck: 'Avtotransport' },
    equipment: { SHUNTING_LOCO: 'Manevr teplovozi', WAGON: 'Vagon' },
    deal: { RENT: 'Ijara', SALE: 'Sotuv' },
    unit: { PER_TON: 't', PER_WAGON: 'vagon', PER_DAY: 'kun', PER_OPERATION: 'operatsiya' },
  },
  ru: {
    region: {
      'UZ-TK': 'Ташкент', 'UZ-TO': 'Ташкентская обл.', 'UZ-SI': 'Сырдарья', 'UZ-JI': 'Джизак', 'UZ-SA': 'Самарканд', 'UZ-BU': 'Бухара', 'UZ-NW': 'Навои',
      'UZ-QA': 'Кашкадарья', 'UZ-SU': 'Сурхандарья', 'UZ-XO': 'Хорезм', 'UZ-QR': 'Каракалпакстан', 'UZ-AN': 'Андижан', 'UZ-NG': 'Наманган', 'UZ-FA': 'Фергана',
    },
    service: { LOAD: 'Погрузка', UNLOAD: 'Выгрузка', WEIGH: 'Весы', STORAGE: 'Хранение', SVX: 'Таможенный склад', CONTAINER: 'Контейнер', LAST_MILE: 'Автодоставка', SHUNTING: 'Маневры' },
    kind: { RAIL: 'Железнодорожный грузовой терминал', ROAD: 'Автомобильный грузовой терминал', MULTI: 'Авто и железнодорожный терминал' },
    category: { terminal: 'Терминал', equipment: 'Ж/д техника', truck: 'Автотранспорт' },
    equipment: { SHUNTING_LOCO: 'Маневровый тепловоз', WAGON: 'Вагон' },
    deal: { RENT: 'Аренда', SALE: 'Продажа' },
    unit: { PER_TON: 'т', PER_WAGON: 'вагон', PER_DAY: 'день', PER_OPERATION: 'операция' },
  },
  en: {
    region: {
      'UZ-TK': 'Tashkent', 'UZ-TO': 'Tashkent region', 'UZ-SI': 'Syrdarya', 'UZ-JI': 'Jizzakh', 'UZ-SA': 'Samarkand', 'UZ-BU': 'Bukhara', 'UZ-NW': 'Navoi',
      'UZ-QA': 'Kashkadarya', 'UZ-SU': 'Surkhandarya', 'UZ-XO': 'Khorezm', 'UZ-QR': 'Karakalpakstan', 'UZ-AN': 'Andijan', 'UZ-NG': 'Namangan', 'UZ-FA': 'Fergana',
    },
    service: { LOAD: 'Loading', UNLOAD: 'Unloading', WEIGH: 'Weighing', STORAGE: 'Storage', SVX: 'Bonded warehouse', CONTAINER: 'Container', LAST_MILE: 'Truck delivery', SHUNTING: 'Shunting' },
    kind: { RAIL: 'Rail freight terminal', ROAD: 'Road freight terminal', MULTI: 'Road and rail terminal' },
    category: { terminal: 'Terminal', equipment: 'Rail equipment', truck: 'Road transport' },
    equipment: { SHUNTING_LOCO: 'Shunting locomotive', WAGON: 'Wagon' },
    deal: { RENT: 'Rent', SALE: 'Sale' },
    unit: { PER_TON: 't', PER_WAGON: 'wagon', PER_DAY: 'day', PER_OPERATION: 'operation' },
  },
};

// Miqdor so'zlari: uz o'zgarmas, en [birlik, ko'plik], ru [1, 2-4, 5+]
const QTY: Record<Lang, Record<string, string[]>> = {
  uz: { wagons: ['vagon'], tonnes: ['tonna'], containers: ['konteyner'] },
  ru: {
    wagons: ['вагон', 'вагона', 'вагонов'], tonnes: ['тонна', 'тонны', 'тонн'], containers: ['контейнер', 'контейнера', 'контейнеров'],
    terminals: ['терминал', 'терминала', 'терминалов'], slots: ['место', 'места', 'мест'],
  },
  en: { wagons: ['wagon', 'wagons'], tonnes: ['tonne', 'tonnes'], containers: ['container', 'containers'] },
};
function qtyWord(lang: Lang, unit: string, n: number): string {
  const w = QTY[lang][unit] ?? [unit];
  if (w.length < 3) return w[n === 1 ? 0 : w.length - 1]!;
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return w[0]!;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return w[1]!;
  return w[2]!;
}

function chipLabel(c: Chip, lang: Lang): string {
  const L = LABELS[lang];
  switch (c.type) {
    case 'corridor': { const [a, b] = c.value.split('>'); return `${L.region![a!] ?? a} → ${L.region![b!] ?? b}`; }
    case 'near': return lang === 'ru' ? `в радиусе ${c.value} км` : lang === 'en' ? `within ${c.value} km` : `${c.value} km ichida`;
    case 'qty': { const [unit, n] = c.value.split('='); return `${n} ${qtyWord(lang, unit!, Number(n))}`; }
    case 'bookable': return lang === 'ru' ? 'Свободно сегодня' : lang === 'en' ? 'Free today' : "Bugun bo'sh";
    default: return L[c.type]?.[c.value] ?? c.value;
  }
}

const T: Record<Lang, {
  som: string; filter: string; open: string; inApp: string; app: string; appHint: string; map: string; none: string; down: string; hint: string;
  // Saytdagi "Namuna" yorlig'ining matni: Telegram da belgi chizib bo'lmaydi, shuning uchun so'z bilan
  demo: string;
  terminals: (n: number) => string; free: (n: number) => string; cheapest: (p: string) => string; nearest: (km: number) => string; slots: (n: number) => string;
  // Kirish oqimi: /start dan kod kelguncha
  contactBtn: string; welcome: string; askPhone: string; askPhoneLogin: string; ownContactOnly: string;
  linkFailed: string; linkedApp: string; linkedCode: string; linkedNoCode: string; help: string;
}> = {
  uz: {
    som: "so'm", filter: 'Filtr', open: 'Ochish', inApp: 'Ilovada ochish', app: 'Ilovani ochish', map: 'Xaritada', demo: 'Namuna, haqiqiy taklif emas',
    appHint: 'Mini ilova: qidiruv, bron va buyurtmalar Telegram ichida.',
    none: "Hech narsa topilmadi. Filtrni kengaytirib ko'ring.",
    down: "Server javob bermadi. Bir daqiqadan keyin qayta urinib ko'ring.",
    hint: "Nima kerakligini oddiy so'zlar bilan yozing, masalan:\n• Andijonda tushirish\n• Toshkentga 50 km ichida tarozisi bor yuk saroyi\n• Qo'qonda vagon ijaraga",
    terminals: (n) => `${n} terminal`, free: (n) => `${n} tasida bugun bo'sh joy`, cheapest: (p) => `eng arzon ${p}`, nearest: (km) => `eng yaqini ${km} km`,
    slots: (n) => (n > 0 ? `Bugun ${n} ta bo'sh joy` : "Bugun bo'sh joy yo'q"),
    contactBtn: "📱 Telefon raqamimni yuborish",
    welcome: "YukSaroy ga xush kelibsiz.\nVagon raqamini shunchaki yuborsangiz, oxirgi joylashuvi chiqadi. Terminal uchun nima kerakligini oddiy so'zlar bilan yozing.",
    askPhone: "Platformaga kirish kodini shu yerda olasiz. Avval telefon raqamingizni tasdiqlang:",
    askPhoneLogin: 'Kirish uchun telefon raqamingizni tasdiqlang.',
    ownContactOnly: "Iltimos, faqat o'z raqamingizni yuboring. Buning uchun pastdagi tugmadan foydalaning.",
    linkFailed: "Xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring.",
    linkedApp: "Telefon bog'landi, ilovaga qayting.",
    linkedCode: "Raqam bog'landi. Kirish kodi keyingi xabarda keladi.",
    linkedNoCode: "Raqam bog'landi. Endi platformada telefon raqamingizni kiriting, kod shu yerga keladi.",
    help: "YukSaroy: yuk logistikasi bozori.\n\nQidiruv: nima kerakligini oddiy so'zlar bilan yozing yoki /qidir buyrug'idan foydalaning, masalan: \"Andijonda tushirish\". Bot terminallar sonini, bugungi bo'sh joylarni va eng arzon tarifni ko'rsatadi.\n\nVagon qayerda: vagon raqamini yuboring yoki /vagon 24567890 deb yozing. Oxirgi joylashuvi, stansiyasi va yuklangan yo bo'shligi chiqadi. Buning uchun telefon raqamingiz tasdiqlangan bo'lishi kerak.\n\nKirish: /start yuboring va telefon raqamingizni tasdiqlang. Platformada raqamingizni kiritganingizda kirish kodi shu yerga keladi, kod 5 daqiqa amal qiladi.",
  },
  ru: {
    som: 'сум', filter: 'Фильтр', open: 'Открыть', inApp: 'В приложении', app: 'Открыть приложение', map: 'На карте', demo: 'Образец, не настоящее предложение',
    appHint: 'Мини-приложение: поиск, бронирование и заказы внутри Telegram.',
    none: 'Ничего не найдено. Попробуйте расширить фильтр.',
    down: 'Сервер не ответил. Повторите через минуту.',
    hint: 'Напишите, что нужно, простыми словами, например:\n• Выгрузка в Андижане\n• Грузовой двор с весами в радиусе 50 км от Ташкента\n• Вагон в аренду в Коканде',
    terminals: (n) => `${n} ${qtyWord('ru', 'terminals', n)}`, free: (n) => `${n} со свободными местами сегодня`, cheapest: (p) => `дешевле всего ${p}`, nearest: (km) => `ближайший ${km} км`,
    slots: (n) => (n > 0 ? `Сегодня свободно: ${n} ${qtyWord('ru', 'slots', n)}` : 'Сегодня свободных мест нет'),
    contactBtn: "📱 Отправить мой номер",
    welcome: 'Добро пожаловать в YukSaroy.\nОтправьте номер вагона, и придёт его последнее местоположение. Нужен терминал: напишите простыми словами, что нужно.',
    askPhone: 'Код для входа на платформу придёт сюда. Сначала подтвердите номер телефона:',
    askPhoneLogin: 'Для входа подтвердите номер телефона.',
    ownContactOnly: 'Отправьте, пожалуйста, только свой номер. Воспользуйтесь кнопкой ниже.',
    linkFailed: 'Произошла ошибка. Попробуйте чуть позже.',
    linkedApp: 'Номер привязан, вернитесь в приложение.',
    linkedCode: 'Номер привязан. Код для входа придёт следующим сообщением.',
    linkedNoCode: 'Номер привязан. Теперь введите его на платформе, код придёт сюда.',
    help: 'YukSaroy: маркетплейс грузовой логистики.\n\nПоиск: напишите простыми словами, что нужно, или используйте /qidir. Бот покажет число терминалов, свободные места на сегодня и самый дешёвый тариф.\n\nГде вагон: отправьте номер вагона или напишите /vagon 24567890. Придёт последнее местоположение, станция и гружёный или порожний. Для этого нужен подтверждённый номер телефона.\n\nВход: отправьте /start и подтвердите номер. Когда введёте его на платформе, код придёт сюда и будет действовать 5 минут.',
  },
  en: {
    som: 'UZS', filter: 'Filter', open: 'Open', inApp: 'In the app', app: 'Open the app', map: 'On map', demo: 'Sample, not a real offer',
    appHint: 'Mini App: search, booking and orders inside Telegram.',
    none: 'Nothing found. Try widening the filter.',
    down: 'Server did not respond. Try again in a minute.',
    hint: 'Describe what you need in plain words, for example:\n• Unloading in Andijan\n• Freight yard with a scale within 50 km of Tashkent\n• Wagon for rent in Kokand',
    terminals: (n) => `${n} terminal${n === 1 ? '' : 's'}`, free: (n) => `${n} with free spots today`, cheapest: (p) => `cheapest ${p}`, nearest: (km) => `nearest ${km} km`,
    slots: (n) => (n > 0 ? `${n} free spot${n === 1 ? '' : 's'} today` : 'No free spots today'),
    contactBtn: "📱 Send my phone number",
    welcome: 'Welcome to YukSaroy.\nSend a wagon number and its last known location comes back. For a terminal, write in plain words what you need.',
    askPhone: 'Your sign-in code will arrive here. First confirm your phone number:',
    askPhoneLogin: 'Confirm your phone number to sign in.',
    ownContactOnly: 'Please send only your own number. Use the button below.',
    linkFailed: 'Something went wrong. Try again shortly.',
    linkedApp: 'Phone linked, go back to the app.',
    linkedCode: 'Phone linked. The sign-in code arrives in the next message.',
    linkedNoCode: 'Phone linked. Enter the number on the platform and the code will arrive here.',
    help: 'YukSaroy: a freight logistics marketplace.\n\nSearch: describe what you need in plain words or use /qidir. The bot shows the number of terminals, free spots today and the cheapest tariff.\n\nWhere is my wagon: send a wagon number or write /vagon 24567890. You get its last known location, station and whether it is loaded or empty. This needs your phone number confirmed.\n\nSign in: send /start and confirm your phone number. When you enter it on the platform, the code arrives here and is valid for 5 minutes.',
  },
};

// ── Vagon qidiruvi ──

/** POST /wagon/internal/telegram/search javobi (kerakli maydonlar). */
type WagonRes = {
  wagonNo: string;
  found: boolean;
  current: { date: string; station: string | null; state: 'loaded' | 'empty' | 'unknown' } | null;
  quota: { subscriber: boolean; freeUsed: number; freeTotal: number; priceSom: number };
};

/**
 * Matndagi vagon raqami yoki null.
 *
 * Faqat raqam, probel va chiziqchadan tashkil topgan matn tekshiriladi: shunda "Andijonda
 * tushirish" kabi so'rov xatolik bilan vagon deb qabul qilinmaydi. Raqamlar soni domain
 * dagi WAGON bilan bir xil (7 yoki 8); bot domain paketiga bog'lanmaydi, shuning uchun
 * shart shu yerda takrorlangan.
 */
const wagonNoOf = (text: string): string | null => {
  if (!/^[\d\s-]+$/.test(text)) return null;
  const d = text.replace(/\D/g, '');
  return d.length >= 7 && d.length <= 8 ? d : null;
};

/** Sana hisobotdan ISO ko'rinishda keladi; vaqti bo'lsa kesiladi, boshqa shakl tegilmaydi. */
const dayOf = (d: string) => (/^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : d);

/** Vagon matnlari: saytdagi wagon.json tarjimalari bilan bir xil so'zlar. */
const W: Record<Lang, {
  btn: string; hint: string; notLinked: string; notFound: (no: string) => string;
  current: string; stationUnknown: string; state: Record<'loaded' | 'empty' | 'unknown', string>;
  date: string; subscribe: string; price: (som: string) => string; subscribeCta: string;
  quotaFree: (left: number) => string; err: Record<string, string>;
}> = {
  uz: {
    btn: 'Vagon qayerda',
    hint: "Vagon raqamini yozing, masalan: 24567890. Raqam 7 yoki 8 ta raqamdan iborat.",
    notLinked: "Vagon qidiruvi uchun telefon raqamingizni tasdiqlash kerak.",
    notFound: (no) => `${no} raqamli vagon topilmadi. Raqamni tekshirib qayta urinib ko'ring.`,
    current: 'Oxirgi joylashuvi', stationUnknown: "Stansiya ko'rsatilmagan",
    state: { loaded: 'Yuklangan', empty: "Bo'sh", unknown: "Holati noma'lum" },
    date: 'Vaqti',
    subscribe: 'Bepul qidiruv tugadi. Cheksiz qidiruv uchun obuna kerak.',
    price: (som) => `Oyiga ${som} so'm.`, subscribeCta: "Obuna bo'lish",
    quotaFree: (left) => `Bepul qidiruv qoldi: ${left} ta`,
    err: {
      WAGON_NO_INVALID: "Raqam 7 yoki 8 ta raqamdan iborat bo'lishi kerak.",
      WAGON_NOT_CONFIGURED: "Vagon qidiruvi hozircha ishlamayapti. Tez orada ishga tushadi.",
      WAGON_UPSTREAM: "Hozir qidirib bo'lmadi. Birozdan keyin qayta urinib ko'ring.",
      RATE_LIMITED: "Juda ko'p qidiruv. Bir soatdan keyin davom etadi.",
      generic: "Qidirilmadi. Qayta urinib ko'ring.",
    },
  },
  ru: {
    btn: 'Где вагон',
    hint: 'Напишите номер вагона, например: 24567890. Номер состоит из 7 или 8 цифр.',
    notLinked: 'Для поиска вагона нужно подтвердить номер телефона.',
    notFound: (no) => `Вагон ${no} не найден. Проверьте номер и попробуйте снова.`,
    current: 'Последнее местоположение', stationUnknown: 'Станция не указана',
    state: { loaded: 'Гружёный', empty: 'Порожний', unknown: 'Состояние неизвестно' },
    date: 'Время',
    subscribe: 'Бесплатный поиск закончился. Для поиска без ограничений нужна подписка.',
    price: (som) => `${som} сум в месяц.`, subscribeCta: 'Оформить подписку',
    quotaFree: (left) => `Осталось бесплатных поисков: ${left}`,
    err: {
      WAGON_NO_INVALID: 'Номер должен состоять из 7 или 8 цифр.',
      WAGON_NOT_CONFIGURED: 'Поиск вагона пока не работает. Скоро заработает.',
      WAGON_UPSTREAM: 'Сейчас найти не получилось. Попробуйте чуть позже.',
      RATE_LIMITED: 'Слишком много запросов. Продолжить можно через час.',
      generic: 'Не удалось найти. Попробуйте ещё раз.',
    },
  },
  en: {
    btn: 'Where is my wagon',
    hint: 'Send a wagon number, for example: 24567890. The number has 7 or 8 digits.',
    notLinked: 'Wagon search needs your phone number confirmed.',
    notFound: (no) => `Wagon ${no} was not found. Check the number and try again.`,
    current: 'Last known location', stationUnknown: 'Station not given',
    state: { loaded: 'Loaded', empty: 'Empty', unknown: 'State unknown' },
    date: 'Time',
    subscribe: 'Your free search is used up. Unlimited searches need a subscription.',
    price: (som) => `${som} UZS per month.`, subscribeCta: 'Subscribe',
    quotaFree: (left) => `Free searches left: ${left}`,
    err: {
      WAGON_NO_INVALID: 'The number must have 7 or 8 digits.',
      WAGON_NOT_CONFIGURED: 'Wagon search is not working yet. It will be available soon.',
      WAGON_UPSTREAM: 'The search did not go through. Try again in a little while.',
      RATE_LIMITED: 'Too many searches. You can continue in an hour.',
      generic: 'Search failed. Try again.',
    },
  },
};

/** Tiyin -> "18 500 so'm / t" (domain formatSom bilan bir xil format). */
const price = (tiyin: number, unit: string | null, lang: Lang) =>
  `${Math.round(tiyin / 100).toLocaleString('ru-RU').replace(/\s/g, ' ')} ${T[lang].som}${unit ? ` / ${LABELS[lang].unit![unit] ?? unit}` : ''}`;

const webPath = (lang: Lang, p: string) => `${env.WEB_URL}${lang === 'uz' ? '' : `/${lang}`}${p}`;

/** Mini App tugmasi: https bo'lsa web_app (APP_URL + path), ommaviy sayt bo'lsa url, aks holda tugma yo'q. */
const appBtn = (text: string, path: string, lang: Lang, sitePath = path) =>
  WEB_APP ? Markup.button.webApp(text, `${APP_URL}${path}`) : PUBLIC_LINK ? Markup.button.url(text, webPath(lang, sitePath)) : null;
type Btn = ReturnType<typeof Markup.button.url> | ReturnType<typeof Markup.button.webApp>;
/** Faqat haqiqiy tugmalar qoladi: bo'sh qator Telegram xatosiga olib keladi. */
const rowsOf = (rows: (Btn | null)[][]) =>
  rows.map((r) => r.filter((b): b is Btn => b !== null)).filter((r) => r.length > 0);
const appKeyboard = (lang: Lang) => {
  // Vagon tugmasi aynan shu yerda: asosiy shikoyat odam /start dan keyin vagon qidiruvi
  // borligini umuman ko'rmasligi edi. Mini App da APP_URL + /wagon (ya'ni /tg/wagon),
  // https bo'lmasa sayt tomonidagi /wagon sahifasi ochiladi.
  const rows = rowsOf([[appBtn(T[lang].app, '', lang)], [appBtn(W[lang].btn, '/wagon', lang)]]);
  return rows.length ? Markup.inlineKeyboard(rows) : undefined;
};

async function search(ctx: Context, q: string, lang: Lang) {
  const t = T[lang];
  let parsed: ParseRes, cards: Card[];
  try {
    // Uzun matn API da 400 beradi: kesib yuboriladi
    const p = await api('/search/parse', { method: 'POST', body: JSON.stringify({ q: q.slice(0, 300), lang }) });
    if (!p.ok) throw new Error(`parse ${p.status}`);
    parsed = (await p.json()) as ParseRes;
    // Oddiy nom ("Sergeli") hech qanday chip bermaydi, lekin nom bo'yicha topiladi:
    // maslahat matni faqat nom qidiruvi ham bo'sh bo'lganda ko'rsatiladi
    if (parsed.filters.confidence === 0 && parsed.chips.length === 0 && parsed.decision.terminals === 0) return ctx.reply(t.hint);
    // q nom bo'yicha filtrlaydi va ro'yxatda ham qoladi (aks holda "Sergeli" hamma terminalni beradi)
    const r = await api(`/terminals?${new URLSearchParams({ ...parsed.query, limit: '3' })}`);
    if (!r.ok) throw new Error(`terminals ${r.status}`);
    cards = ((await r.json()) as { items: Card[] }).items;
  } catch (e) {
    console.error('qidiruv xatosi:', e);
    return ctx.reply(t.down);
  }

  const d = parsed.decision;
  const decision = [
    // Nol sanoq yozilmaydi (egasi qarori 2026-10-07): sonlar namunasiz, faqat namuna topilganda
    // "0 terminal" ostida Namuna kartalari turardi. Bo'sh joy ham ko'pincha 0, namuna kartasi esa
    // "Bugun 8 ta bo'sh joy" deydi. freeToday > 0 bo'lsa terminal ham bor
    d.terminals > 0 ? t.terminals(d.terminals) : null,
    d.freeToday > 0 ? t.free(d.freeToday) : null,
    d.cheapestTiyin !== null ? t.cheapest(price(d.cheapestTiyin, d.cheapestUnit, lang)) : null,
    d.nearestKm !== null ? t.nearest(Math.round(d.nearestKm)) : null,
  ].filter(Boolean).join(' · ');
  const chips = parsed.chips.map((c) => chipLabel(c, lang)).join(' · ');

  const L = LABELS[lang];
  const body = cards.map((c, i) => [
    `${i + 1}. <b>${esc(c.name)}</b>`,
    // Namuna saytdagidek belgilanadi: odam uni haqiqiy terminal deb joy so'ramasin. Yuqoridagi son uni sanamaydi
    c.isDemo ? `<i>${esc(t.demo)}</i>` : null,
    [L.kind![c.kind] ?? c.kind, c.regionCode ? L.region![c.regionCode] ?? c.regionCode : null].filter(Boolean).join(' · '),
    c.fromPriceTiyin !== null ? price(c.fromPriceTiyin, 'PER_TON', lang) : null,
    typeof c.freeToday === 'number' ? t.slots(c.freeToday) : null,
  ].filter(Boolean).join('\n'));

  // Qaror satri bo'sh bo'lsa (hamma son 0) qatori ham yo'q: bo'sh <b></b> chiqmasin
  const text = [decision ? `<b>${esc(decision)}</b>` : null, chips ? `${t.filter}: ${esc(chips)}` : null, '', body.length ? body.join('\n\n') : t.none].filter((x) => x !== null).join('\n');
  // Har karta o'z qatorida: "Ilovada ochish N" web_app (https) yoki "Ochish N" sayt havolasi
  const rows = rowsOf([
    ...cards.map((c, i) => [appBtn(`${WEB_APP ? t.inApp : t.open} ${i + 1}`, `/terminals/${c.slug}`, lang)]),
    [PUBLIC_LINK ? Markup.button.url(t.map, webPath(lang, `/terminals?${new URLSearchParams(parsed.query)}`)) : null],
  ]);
  return ctx.reply(text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(rows.length ? Markup.inlineKeyboard(rows) : {}) });
}

/**
 * Vagon qayerda: qidiruvni API bajaradi, bot faqat chat raqamini beradi.
 *
 * Kvota, obuna devori va 6 soatlik kesh serverda: bot ularni bilmaydi va bila olmaydi.
 * Shu tufayli botdan qidirish bilan saytdan qidirish bir xil hisoblanadi.
 */
async function wagon(ctx: Context, no: string, lang: Lang) {
  const w = W[lang];
  let res: Response;
  try {
    res = await api('/wagon/internal/telegram/search', {
      method: 'POST',
      headers: { 'x-internal-secret': env.INTERNAL_SECRET },
      body: JSON.stringify({ chatId: String(ctx.chat?.id ?? ''), no }),
    });
  } catch {
    return ctx.reply(T[lang].down);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { code?: string; priceSom?: number } | null;
    const code = body?.code ?? '';
    // Telefon tasdiqlanmagan: matn bilan tushuntirmaymiz, darhol tugmani beramiz
    if (code === 'NOT_LINKED') return askContact(ctx, lang, w.notLinked);
    if (code === 'SUBSCRIPTION_REQUIRED') {
      const price = body?.priceSom ? ` ${w.price(body.priceSom.toLocaleString('ru-RU').replace(/\s/g, ' '))}` : '';
      // Obuna sahifasi ikki tomonda ikki xil yo'lda: Mini App da /tg/subscription,
      // saytda /dashboard/subscription. Oldin ikkalasi uchun ham ikkinchisi berilardi,
      // ya'ni Mini App tugmasi mavjud bo'lmagan /tg/dashboard/subscription ga olib borardi.
      const rows = rowsOf([[appBtn(w.subscribeCta, '/subscription', lang, '/dashboard/subscription')]]);
      return ctx.reply(`${w.subscribe}${price}`, rows.length ? Markup.inlineKeyboard(rows) : undefined);
    }
    return ctx.reply(w.err[code] ?? w.err.generic!);
  }

  const r = (await res.json()) as WagonRes;
  if (!r.found || !r.current) return ctx.reply(w.notFound(r.wagonNo));
  const c = r.current;
  const lines = [
    `<b>${esc(c.station ?? w.stationUnknown)}</b>`,
    `${w.current} · ${esc(r.wagonNo)}`,
    `${w.state[c.state]} · ${w.date}: ${esc(dayOf(c.date))}`,
  ];
  // Obunachiga kvota satri yozilmaydi: unda cheksiz, ya'ni bu son hech qanday qarorga yaramaydi
  if (!r.quota.subscriber) {
    lines.push('', w.quotaFree(Math.max(0, r.quota.freeTotal - r.quota.freeUsed)));
  }
  return ctx.reply(lines.join('\n'), { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
}

// ── Kirish oqimi ──

// Biz kontakt so'ragan chatlar; ro'yxatda yo'q kontakt = Mini App requestContact
// ponytail: xotirada, bot qayta ishga tushsa eski keyboard kontakt ham "ilova" deb qabul qilinadi
const asked = new Set<number>();
const askContact = (ctx: Context, lang: Lang, text: string) => {
  if (ctx.chat) asked.add(ctx.chat.id);
  return ctx.reply(text, Markup.keyboard([Markup.button.contactRequest(T[lang].contactBtn)]).oneTime().resize());
};

bot.start(async (ctx) => {
  const payload = ctx.payload?.trim();
  if (payload?.startsWith('login_')) pendingToken.set(ctx.chat.id, payload.slice('login_'.length));
  const lang = langOf(ctx.from.language_code);
  await ctx.reply(T[lang].welcome, appKeyboard(lang));
  await askContact(ctx, lang, T[lang].askPhone);
});

bot.on('contact', async (ctx) => {
  const c = ctx.message.contact;
  const lang = langOf(ctx.from.language_code);
  // Boshqa odamning kontaktini yuborib bo'lmaydi: raqam egasi shu foydalanuvchi bo'lishi shart
  if (c.user_id !== ctx.from.id) {
    return ctx.reply(T[lang].ownContactOnly);
  }
  const linkToken = pendingToken.get(ctx.chat.id);
  const fromApp = !asked.has(ctx.chat.id);
  let res: Response;
  try {
    res = await api('/auth/internal/telegram/link', {
      method: 'POST',
      headers: { 'x-internal-secret': env.INTERNAL_SECRET },
      body: JSON.stringify({ chatId: String(ctx.chat.id), phone: c.phone_number, username: ctx.from.username ?? null, linkToken }),
    });
  } catch {
    // Tarmoq yoki API tushib qolgan: foydalanuvchi aybdor emas, tugma qoladi
    return ctx.reply(T[lang].down);
  }
  pendingToken.delete(ctx.chat.id);
  asked.delete(ctx.chat.id);
  if (!res.ok) return ctx.reply(T[lang].linkFailed, Markup.removeKeyboard());
  if (fromApp) return ctx.reply(T[lang].linkedApp);

  const r = (await res.json().catch(() => ({ codeSent: false }))) as { codeSent: boolean };
  await ctx.reply(
    r.codeSent ? T[lang].linkedCode : T[lang].linkedNoCode,
    Markup.removeKeyboard(),
  );
});

bot.command('help', (ctx) => ctx.reply(T[langOf(ctx.from.language_code)].help));
bot.command('app', (ctx) => { const lang = langOf(ctx.from.language_code); return ctx.reply(T[lang].appHint, appKeyboard(lang)); });

// /qidir matn: 'text' dan oldin ro'yxatga olinadi, aks holda umumiy matn ushlab qoladi
bot.command('qidir', (ctx) => {
  const lang = langOf(ctx.from.language_code);
  const q = ctx.payload.trim();
  return q ? search(ctx, q, lang) : ctx.reply(T[lang].hint);
});

bot.command('vagon', (ctx) => {
  const lang = langOf(ctx.from.language_code);
  const q = ctx.payload.trim();
  if (!q) return ctx.reply(W[lang].hint);
  // Raqam shakli serverda ham tekshiriladi; bu yerda tekshirish bekor chaqiruvni to'xtatadi
  const no = wagonNoOf(q);
  return no ? wagon(ctx, no, lang) : ctx.reply(W[lang].err.WAGON_NO_INVALID!);
});

// Erkin matn: login kutilayotgan bo'lsa kontakt so'raymiz, aks holda qidiruv
bot.on('text', (ctx) => {
  // Bir marta so'raladi va qulf bo'shatiladi: tashlab ketilgan kirish havolasi
  // shu chat uchun erkin qidiruvni butunlay o'chirib qo'yardi
  const lang = langOf(ctx.from.language_code);
  if (pendingToken.has(ctx.chat.id)) { pendingToken.delete(ctx.chat.id); return askContact(ctx, lang, T[lang].askPhoneLogin); }
  const q = ctx.message.text.trim();
  if (q.startsWith('/')) return ctx.reply(T[lang].help);
  // Yalang'och raqam terminal qidiruvi uchun ma'no bermaydi: u vagon raqami bo'ladi
  const no = wagonNoOf(q);
  return no ? wagon(ctx, no, lang) : search(ctx, q, lang);
});

bot.catch((err, ctx) => {
  console.error('bot xatosi:', ctx.updateType, err);
});

// ── Buyruqlar menyusi ──

// Telegram dagi "/" menyusi. Tartib shu ro'yxatdagidek ko'rinadi: avval kirish,
// keyin eng ko'p so'raladigan vagon qidiruvi.
// ponytail: scripts/setup-profile.mjs dagi CMDS endi ortiqcha (u qo'lda ishga tushirilardi
// va hech kim tushirmagan, shuning uchun menyu bo'sh edi). Keyingi tegishda o'sha fayldan
// faqat CMDS loop i o'chirilsin, nom va tavsif o'rnatish o'sha yerda qolaveradi.
const CMD_ORDER = ['start', 'vagon', 'qidir', 'app', 'help'] as const;
// Tavsif kichik harfdan boshlanadi (Telegram menyusidagi odat) va 256 belgidan qisqa.
// Uchta til bitta jadvalda: kalitlar tipdan kelib chiqib aynan teng bo'lishga majbur.
const CMD_DESC: Record<Lang, Record<(typeof CMD_ORDER)[number], string>> = {
  uz: {
    start: 'boshlash va telefon raqamini tasdiqlash',
    vagon: 'vagon qayerda, masalan: /vagon 24567890',
    qidir: 'terminal qidirish, masalan: /qidir Andijonda tushirish',
    app: 'mini ilovani ochish',
    help: 'bot nima qiladi',
  },
  ru: {
    start: 'начать и подтвердить номер телефона',
    vagon: 'где вагон, например: /vagon 24567890',
    qidir: 'поиск терминала, например: /qidir выгрузка в Андижане',
    app: 'открыть мини-приложение',
    help: 'что умеет бот',
  },
  en: {
    start: 'start and confirm your phone number',
    vagon: 'where is my wagon, e.g. /vagon 24567890',
    qidir: 'find a terminal, e.g. /qidir unloading in Andijan',
    app: 'open the Mini App',
    help: 'what this bot does',
  },
};

/**
 * Buyruqlar ro'yxatini Telegram ga yozadi.
 *
 * Har til alohida chaqiriladi, chunki Telegram ro'yxatni mijozning language_code iga
 * qarab tanlaydi. Tilsiz chaqiruv sukut nusxa: mijoz tiliga ro'yxat topilmasa shu
 * ko'rinadi, bizda u uz.
 *
 * Xato butun botni yiqitmaydi: ro'yxat eskirgan bo'lsa ham bot javob berishi kerak,
 * shuning uchun har chaqiruv o'z catch i bilan va faqat console ga yoziladi.
 */
const setCommands = async () => {
  for (const lang of [null, 'uz', 'ru', 'en'] as const) {
    const commands = CMD_ORDER.map((command) => ({ command, description: CMD_DESC[lang ?? 'uz'][command] }));
    try {
      await bot.telegram.setMyCommands(commands, lang ? { language_code: lang } : undefined);
    } catch (e) {
      console.error('bot: setMyCommands', lang ?? 'default', e);
    }
  }
};

// launch() promise'i to'xtaganda bajariladi: shuning uchun "ishga tushdi" xabari callbackda,
// xato esa ushlanadi (aks holda jim yiqilardi). Buyruqlar ro'yxati ham shu callbackda:
// launch() token ni tekshirgandan keyin bir marta yoziladi va kutilmaydi, shuning uchun
// polling boshlanishi kechikmaydi.
bot.launch(() => { console.log('bot: polling'); void setCommands(); }).catch((e) => { console.error('bot: launch failed', e); process.exit(1); });
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
