// YukSaroy Telegram bot: terminal qidiruvi (API /search/parse orqali) va kirish (OTP) kanali.
// Buyruqlar ro'yxati BotFather'da emas, Bot API orqali o'rnatiladi (scripts/setup-profile.mjs).
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
type Card = { slug: string; name: string; kind: string; regionCode: string | null; fromPriceTiyin: number | null; freeToday?: number };

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
  terminals: (n: number) => string; free: (n: number) => string; cheapest: (p: string) => string; nearest: (km: number) => string; slots: (n: number) => string;
  // Kirish oqimi: /start dan kod kelguncha
  contactBtn: string; welcome: string; askPhone: string; askPhoneLogin: string; ownContactOnly: string;
  linkFailed: string; linkedApp: string; linkedCode: string; linkedNoCode: string; help: string;
}> = {
  uz: {
    som: "so'm", filter: 'Filtr', open: 'Ochish', inApp: 'Ilovada ochish', app: 'Ilovani ochish', map: 'Xaritada',
    appHint: 'Mini ilova: qidiruv, bron va buyurtmalar Telegram ichida.',
    none: "Hech narsa topilmadi. Filtrni kengaytirib ko'ring.",
    down: "Server javob bermadi. Bir daqiqadan keyin qayta urinib ko'ring.",
    hint: "Nima kerakligini oddiy so'zlar bilan yozing, masalan:\n• Andijonda tushirish\n• Toshkentga 50 km ichida tarozisi bor yuk saroyi\n• Qo'qonda vagon ijaraga",
    terminals: (n) => `${n} terminal`, free: (n) => `${n} tasida bugun bo'sh joy`, cheapest: (p) => `eng arzon ${p}`, nearest: (km) => `eng yaqini ${km} km`,
    slots: (n) => (n > 0 ? `Bugun ${n} ta bo'sh joy` : "Bugun bo'sh joy yo'q"),
    contactBtn: "📱 Telefon raqamimni yuborish",
    welcome: 'YukSaroy ga xush kelibsiz.',
    askPhone: "Platformaga kirish kodini shu yerda olasiz. Avval telefon raqamingizni tasdiqlang:",
    askPhoneLogin: 'Kirish uchun telefon raqamingizni tasdiqlang.',
    ownContactOnly: "Iltimos, faqat o'z raqamingizni yuboring. Buning uchun pastdagi tugmadan foydalaning.",
    linkFailed: "Xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring.",
    linkedApp: "Telefon bog'landi, ilovaga qayting.",
    linkedCode: "Raqam bog'landi. Kirish kodi keyingi xabarda keladi.",
    linkedNoCode: "Raqam bog'landi. Endi platformada telefon raqamingizni kiriting, kod shu yerga keladi.",
    help: "YukSaroy: yuk logistikasi bozori.\n\nQidiruv: nima kerakligini oddiy so'zlar bilan yozing yoki /qidir buyrug'idan foydalaning, masalan: \"Andijonda tushirish\". Bot terminallar sonini, bugungi bo'sh joylarni va eng arzon tarifni ko'rsatadi.\n\nKirish: /start yuboring va telefon raqamingizni tasdiqlang. Platformada raqamingizni kiritganingizda kirish kodi shu yerga keladi, kod 5 daqiqa amal qiladi.",
  },
  ru: {
    som: 'сум', filter: 'Фильтр', open: 'Открыть', inApp: 'В приложении', app: 'Открыть приложение', map: 'На карте',
    appHint: 'Мини-приложение: поиск, бронирование и заказы внутри Telegram.',
    none: 'Ничего не найдено. Попробуйте расширить фильтр.',
    down: 'Сервер не ответил. Повторите через минуту.',
    hint: 'Напишите, что нужно, простыми словами, например:\n• Выгрузка в Андижане\n• Грузовой двор с весами в радиусе 50 км от Ташкента\n• Вагон в аренду в Коканде',
    terminals: (n) => `${n} ${qtyWord('ru', 'terminals', n)}`, free: (n) => `${n} со свободными местами сегодня`, cheapest: (p) => `дешевле всего ${p}`, nearest: (km) => `ближайший ${km} км`,
    slots: (n) => (n > 0 ? `Сегодня свободно: ${n} ${qtyWord('ru', 'slots', n)}` : 'Сегодня свободных мест нет'),
    contactBtn: "📱 Отправить мой номер",
    welcome: 'Добро пожаловать в YukSaroy.',
    askPhone: 'Код для входа на платформу придёт сюда. Сначала подтвердите номер телефона:',
    askPhoneLogin: 'Для входа подтвердите номер телефона.',
    ownContactOnly: 'Отправьте, пожалуйста, только свой номер. Воспользуйтесь кнопкой ниже.',
    linkFailed: 'Произошла ошибка. Попробуйте чуть позже.',
    linkedApp: 'Номер привязан, вернитесь в приложение.',
    linkedCode: 'Номер привязан. Код для входа придёт следующим сообщением.',
    linkedNoCode: 'Номер привязан. Теперь введите его на платформе, код придёт сюда.',
    help: 'YukSaroy: маркетплейс грузовой логистики.\n\nПоиск: напишите простыми словами, что нужно, или используйте /qidir. Бот покажет число терминалов, свободные места на сегодня и самый дешёвый тариф.\n\nВход: отправьте /start и подтвердите номер. Когда введёте его на платформе, код придёт сюда и будет действовать 5 минут.',
  },
  en: {
    som: 'UZS', filter: 'Filter', open: 'Open', inApp: 'In the app', app: 'Open the app', map: 'On map',
    appHint: 'Mini App: search, booking and orders inside Telegram.',
    none: 'Nothing found. Try widening the filter.',
    down: 'Server did not respond. Try again in a minute.',
    hint: 'Describe what you need in plain words, for example:\n• Unloading in Andijan\n• Freight yard with a scale within 50 km of Tashkent\n• Wagon for rent in Kokand',
    terminals: (n) => `${n} terminal${n === 1 ? '' : 's'}`, free: (n) => `${n} with free spots today`, cheapest: (p) => `cheapest ${p}`, nearest: (km) => `nearest ${km} km`,
    slots: (n) => (n > 0 ? `${n} free spot${n === 1 ? '' : 's'} today` : 'No free spots today'),
    contactBtn: "📱 Send my phone number",
    welcome: 'Welcome to YukSaroy.',
    askPhone: 'Your sign-in code will arrive here. First confirm your phone number:',
    askPhoneLogin: 'Confirm your phone number to sign in.',
    ownContactOnly: 'Please send only your own number. Use the button below.',
    linkFailed: 'Something went wrong. Try again shortly.',
    linkedApp: 'Phone linked, go back to the app.',
    linkedCode: 'Phone linked. The sign-in code arrives in the next message.',
    linkedNoCode: 'Phone linked. Enter the number on the platform and the code will arrive here.',
    help: 'YukSaroy: a freight logistics marketplace.\n\nSearch: describe what you need in plain words or use /qidir. The bot shows the number of terminals, free spots today and the cheapest tariff.\n\nSign in: send /start and confirm your phone number. When you enter it on the platform, the code arrives here and is valid for 5 minutes.',
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
  const rows = rowsOf([[appBtn(T[lang].app, '', lang)]]);
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
    t.terminals(d.terminals),
    d.terminals > 0 ? t.free(d.freeToday) : null,
    d.cheapestTiyin !== null ? t.cheapest(price(d.cheapestTiyin, d.cheapestUnit, lang)) : null,
    d.nearestKm !== null ? t.nearest(Math.round(d.nearestKm)) : null,
  ].filter(Boolean).join(' · ');
  const chips = parsed.chips.map((c) => chipLabel(c, lang)).join(' · ');

  const L = LABELS[lang];
  const body = cards.map((c, i) => [
    `${i + 1}. <b>${esc(c.name)}</b>`,
    [L.kind![c.kind] ?? c.kind, c.regionCode ? L.region![c.regionCode] ?? c.regionCode : null].filter(Boolean).join(' · '),
    c.fromPriceTiyin !== null ? price(c.fromPriceTiyin, 'PER_TON', lang) : null,
    typeof c.freeToday === 'number' ? t.slots(c.freeToday) : null,
  ].filter(Boolean).join('\n'));

  const text = [`<b>${esc(decision)}</b>`, chips ? `${t.filter}: ${esc(chips)}` : null, '', body.length ? body.join('\n\n') : t.none].filter((x) => x !== null).join('\n');
  // Har karta o'z qatorida: "Ilovada ochish N" web_app (https) yoki "Ochish N" sayt havolasi
  const rows = rowsOf([
    ...cards.map((c, i) => [appBtn(`${WEB_APP ? t.inApp : t.open} ${i + 1}`, `/terminals/${c.slug}`, lang)]),
    [PUBLIC_LINK ? Markup.button.url(t.map, webPath(lang, `/terminals?${new URLSearchParams(parsed.query)}`)) : null],
  ]);
  return ctx.reply(text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(rows.length ? Markup.inlineKeyboard(rows) : {}) });
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

// Erkin matn: login kutilayotgan bo'lsa kontakt so'raymiz, aks holda qidiruv
bot.on('text', (ctx) => {
  // Bir marta so'raladi va qulf bo'shatiladi: tashlab ketilgan kirish havolasi
  // shu chat uchun erkin qidiruvni butunlay o'chirib qo'yardi
  const lang = langOf(ctx.from.language_code);
  if (pendingToken.has(ctx.chat.id)) { pendingToken.delete(ctx.chat.id); return askContact(ctx, lang, T[lang].askPhoneLogin); }
  const q = ctx.message.text.trim();
  if (q.startsWith('/')) return ctx.reply(T[lang].help);
  return search(ctx, q, lang);
});

bot.catch((err, ctx) => {
  console.error('bot xatosi:', ctx.updateType, err);
});

// launch() promise'i to'xtaganda bajariladi: shuning uchun "ishga tushdi" xabari callbackda,
// xato esa ushlanadi (aks holda jim yiqilardi).
bot.launch(() => console.log('bot: polling')).catch((e) => { console.error('bot: launch failed', e); process.exit(1); });
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
