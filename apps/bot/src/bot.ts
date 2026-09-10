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

/** API chaqiruvi, 10 s timeout. Tarmoq xatosi chaqiruvchida ushlanadi. */
const api = (path: string, init?: RequestInit & { headers?: Record<string, string> }) =>
  fetch(`${env.API_URL}/v1${path}`, { ...init, headers: { 'content-type': 'application/json', ...init?.headers }, signal: AbortSignal.timeout(10_000) });

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
    service: { LOAD: 'Yuklash', UNLOAD: 'Tushirish', WEIGH: 'Tarozi', STORAGE: 'Saqlash', SVX: 'SVX', CONTAINER: 'Konteyner', LAST_MILE: 'Avtovyvoz', SHUNTING: 'Manevr' },
    kind: { YARD: 'Yuk saroyi', CONTAINER: 'Konteyner terminali', LC: 'Logistika markazi', SVX: 'SVX ombori' },
    category: { terminal: 'Terminal', siding: "Shahobcha yo'l", equipment: "Temir yo'l texnikasi", truck: 'Avtotransport' },
    equipment: { SHUNTING_LOCO: 'Manevr teplovozi', ELECTRIC_LOCO: 'Elektrovoz', WAGON: 'Vagon' },
    deal: { RENT: 'Ijara', SALE: 'Sotuv' },
    unit: { PER_TON: 't', PER_WAGON: 'vagon', PER_DAY: 'kun', PER_OPERATION: 'operatsiya' },
  },
  ru: {
    region: {
      'UZ-TK': 'Ташкент', 'UZ-TO': 'Ташкентская обл.', 'UZ-SI': 'Сырдарья', 'UZ-JI': 'Джизак', 'UZ-SA': 'Самарканд', 'UZ-BU': 'Бухара', 'UZ-NW': 'Навои',
      'UZ-QA': 'Кашкадарья', 'UZ-SU': 'Сурхандарья', 'UZ-XO': 'Хорезм', 'UZ-QR': 'Каракалпакстан', 'UZ-AN': 'Андижан', 'UZ-NG': 'Наманган', 'UZ-FA': 'Фергана',
    },
    service: { LOAD: 'Погрузка', UNLOAD: 'Выгрузка', WEIGH: 'Весы', STORAGE: 'Хранение', SVX: 'СВХ', CONTAINER: 'Контейнер', LAST_MILE: 'Автовывоз', SHUNTING: 'Маневры' },
    kind: { YARD: 'Грузовой двор', CONTAINER: 'Контейнерный терминал', LC: 'Логистический центр', SVX: 'Склад СВХ' },
    category: { terminal: 'Терминал', siding: 'Подъездной путь', equipment: 'Ж/д техника', truck: 'Автотранспорт' },
    equipment: { SHUNTING_LOCO: 'Маневровый тепловоз', ELECTRIC_LOCO: 'Электровоз', WAGON: 'Вагон' },
    deal: { RENT: 'Аренда', SALE: 'Продажа' },
    unit: { PER_TON: 'т', PER_WAGON: 'вагон', PER_DAY: 'день', PER_OPERATION: 'операция' },
  },
  en: {
    region: {
      'UZ-TK': 'Tashkent', 'UZ-TO': 'Tashkent region', 'UZ-SI': 'Syrdarya', 'UZ-JI': 'Jizzakh', 'UZ-SA': 'Samarkand', 'UZ-BU': 'Bukhara', 'UZ-NW': 'Navoi',
      'UZ-QA': 'Kashkadarya', 'UZ-SU': 'Surkhandarya', 'UZ-XO': 'Khorezm', 'UZ-QR': 'Karakalpakstan', 'UZ-AN': 'Andijan', 'UZ-NG': 'Namangan', 'UZ-FA': 'Fergana',
    },
    service: { LOAD: 'Loading', UNLOAD: 'Unloading', WEIGH: 'Weighing', STORAGE: 'Storage', SVX: 'Bonded (SVX)', CONTAINER: 'Container', LAST_MILE: 'Last mile', SHUNTING: 'Shunting' },
    kind: { YARD: 'Freight yard', CONTAINER: 'Container terminal', LC: 'Logistics center', SVX: 'Bonded warehouse' },
    category: { terminal: 'Terminal', siding: 'Private siding', equipment: 'Rail equipment', truck: 'Road transport' },
    equipment: { SHUNTING_LOCO: 'Shunting locomotive', ELECTRIC_LOCO: 'Electric locomotive', WAGON: 'Wagon' },
    deal: { RENT: 'Rent', SALE: 'Sale' },
    unit: { PER_TON: 't', PER_WAGON: 'wagon', PER_DAY: 'day', PER_OPERATION: 'operation' },
  },
};

// Miqdor so'zlari: uz o'zgarmas, en [birlik, ko'plik], ru [1, 2-4, 5+]
const QTY: Record<Lang, Record<string, string[]>> = {
  uz: { wagons: ['vagon'], tonnes: ['tonna'], containers: ['konteyner'] },
  ru: {
    wagons: ['вагон', 'вагона', 'вагонов'], tonnes: ['тонна', 'тонны', 'тонн'], containers: ['контейнер', 'контейнера', 'контейнеров'],
    terminals: ['терминал', 'терминала', 'терминалов'], slots: ['слот', 'слота', 'слотов'],
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
}> = {
  uz: {
    som: "so'm", filter: 'Filtr', open: 'Ochish', inApp: 'Ilovada ochish', app: 'Ilovani ochish', map: 'Xaritada',
    appHint: 'Mini ilova: qidiruv, bron va buyurtmalar Telegram ichida.',
    none: "Hech narsa topilmadi. Filtrni kengaytirib ko'ring.",
    down: "Server javob bermadi. Bir daqiqadan keyin qayta urinib ko'ring.",
    hint: "Nima kerakligini oddiy so'zlar bilan yozing, masalan:\n• Andijonda tushirish\n• Toshkentga 50 km ichida tarozisi bor yuk saroyi\n• Qo'qonda vagon ijaraga",
    terminals: (n) => `${n} terminal`, free: (n) => `${n} tasida bugun bo'sh slot`, cheapest: (p) => `eng arzon ${p}`, nearest: (km) => `eng yaqini ${km} km`,
    slots: (n) => (n > 0 ? `Bugun ${n} ta bo'sh slot` : "Bugun bo'sh slot yo'q"),
  },
  ru: {
    som: 'сум', filter: 'Фильтр', open: 'Открыть', inApp: 'В приложении', app: 'Открыть приложение', map: 'На карте',
    appHint: 'Мини-приложение: поиск, бронирование и заказы внутри Telegram.',
    none: 'Ничего не найдено. Попробуйте расширить фильтр.',
    down: 'Сервер не ответил. Повторите через минуту.',
    hint: 'Напишите, что нужно, простыми словами, например:\n• Выгрузка в Андижане\n• Грузовой двор с весами в радиусе 50 км от Ташкента\n• Вагон в аренду в Коканде',
    terminals: (n) => `${n} ${qtyWord('ru', 'terminals', n)}`, free: (n) => `${n} со свободными слотами сегодня`, cheapest: (p) => `дешевле всего ${p}`, nearest: (km) => `ближайший ${km} км`,
    slots: (n) => (n > 0 ? `Сегодня свободно: ${n} ${qtyWord('ru', 'slots', n)}` : 'Сегодня свободных слотов нет'),
  },
  en: {
    som: 'UZS', filter: 'Filter', open: 'Open', inApp: 'In the app', app: 'Open the app', map: 'On map',
    appHint: 'Mini App: search, booking and orders inside Telegram.',
    none: 'Nothing found. Try widening the filter.',
    down: 'Server did not respond. Try again in a minute.',
    hint: 'Describe what you need in plain words, for example:\n• Unloading in Andijan\n• Freight yard with a scale within 50 km of Tashkent\n• Wagon for rent in Kokand',
    terminals: (n) => `${n} terminal${n === 1 ? '' : 's'}`, free: (n) => `${n} with free slots today`, cheapest: (p) => `cheapest ${p}`, nearest: (km) => `nearest ${km} km`,
    slots: (n) => (n > 0 ? `${n} free slot${n === 1 ? '' : 's'} today` : 'No free slots today'),
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

const CONTACT_BTN = "📱 Telefon raqamimni yuborish";
const HELP =
  "YukSaroy: yuk logistikasi bozori.\n\n" +
  "Qidiruv: nima kerakligini oddiy so'zlar bilan yozing yoki /qidir buyrug'idan foydalaning, masalan: \"Andijonda tushirish\". " +
  "Bot terminallar sonini, bugungi bo'sh slotlarni va eng arzon tarifni ko'rsatadi.\n\n" +
  "Kirish: /start yuboring va telefon raqamingizni tasdiqlang. Saytda raqamingizni kiritganingizda kirish kodi shu yerga keladi, kod 5 daqiqa amal qiladi.";

// Biz kontakt so'ragan chatlar; ro'yxatda yo'q kontakt = Mini App requestContact
// ponytail: xotirada, bot qayta ishga tushsa eski keyboard kontakt ham "ilova" deb qabul qilinadi
const asked = new Set<number>();
const askContact = (ctx: Context, text: string) => {
  if (ctx.chat) asked.add(ctx.chat.id);
  return ctx.reply(text, Markup.keyboard([Markup.button.contactRequest(CONTACT_BTN)]).oneTime().resize());
};

bot.start(async (ctx) => {
  const payload = ctx.payload?.trim();
  if (payload?.startsWith('login_')) pendingToken.set(ctx.chat.id, payload.slice('login_'.length));
  const kb = appKeyboard(langOf(ctx.from.language_code));
  await ctx.reply('YukSaroy ga xush kelibsiz.', kb);
  await askContact(ctx, 'Saytga kirish kodini shu yerda olasiz. Avval telefon raqamingizni tasdiqlang:');
});

bot.on('contact', async (ctx) => {
  const c = ctx.message.contact;
  // Boshqa odamning kontaktini yuborib bo'lmaydi: raqam egasi shu foydalanuvchi bo'lishi shart
  if (c.user_id !== ctx.from.id) {
    return ctx.reply("Iltimos, faqat o'z raqamingizni yuboring. Buning uchun pastdagi tugmadan foydalaning.");
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
    return ctx.reply("Server javob bermadi. Bir daqiqadan keyin qayta urinib ko'ring.");
  }
  pendingToken.delete(ctx.chat.id);
  asked.delete(ctx.chat.id);
  if (!res.ok) return ctx.reply("Xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring.", Markup.removeKeyboard());
  if (fromApp) return ctx.reply("Telefon bog'landi, ilovaga qayting.");

  const r = (await res.json().catch(() => ({ codeSent: false }))) as { codeSent: boolean };
  await ctx.reply(
    r.codeSent
      ? "Raqam bog'landi. Kirish kodi keyingi xabarda keladi."
      : "Raqam bog'landi. Endi saytda telefon raqamingizni kiriting, kod shu yerga keladi.",
    Markup.removeKeyboard(),
  );
});

bot.command('help', (ctx) => ctx.reply(HELP));
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
  if (pendingToken.has(ctx.chat.id)) { pendingToken.delete(ctx.chat.id); return askContact(ctx, 'Kirish uchun telefon raqamingizni tasdiqlang.'); }
  const q = ctx.message.text.trim();
  if (q.startsWith('/')) return ctx.reply(HELP);
  return search(ctx, q, langOf(ctx.from.language_code));
});

bot.catch((err, ctx) => {
  console.error('bot xatosi:', ctx.updateType, err);
});

// launch() promise'i to'xtaganda bajariladi: shuning uchun "ishga tushdi" xabari callbackda,
// xato esa ushlanadi (aks holda jim yiqilardi).
bot.launch(() => console.log('bot: polling')).catch((e) => { console.error('bot: launch failed', e); process.exit(1); });
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
