/**
 * Ko'rgazmani (explainer) brauzerda ochib videoga oladi.
 *
 * NEGA saytning o'zidan yoziladi: Telegram va Instagram uchun mp4 alohida montaj
 * qilinsa, sayt o'zgarganda video eskirib qoladi va buni hech kim sezmaydi.
 * Manba bitta bo'lganda video har doim saytning ayni holatini ko'rsatadi.
 *
 * NEGA qo'lda yuritiladi va CI da yo'q: video har o'zgarishda emas, e'lon
 * berilganda kerak. Uch til = uch yugurish.
 *
 * Ishlatish (avval server ko'tariladi, scripts/README-video.md ga qarang):
 *   node scripts/explainer-video.mjs uz
 *   node scripts/explainer-video.mjs ru http://localhost:3015
 *   node scripts/explainer-video.mjs en --telefon
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';
import { chromium } from 'playwright';

const LOCALES = ['uz', 'ru', 'en'];
// Besh qadam x 4000 ms = 20 s bir aylanish (Explainer.tsx dagi STEP_MS), ustiga bir soniya
// zaxira: oxirgi qadam to'liq ko'rinib, ko'rgazma boshiga qaytgani bilinsin.
const CYCLE = 21_000;
// Chiqish papkasi skript joyiga bog'langan, cwd ga emas: reponing istalgan yeridan chaqirilsin.
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.video');

const fail = (msg) => { throw new Error(msg); };

let browser;
try {
  const argv = process.argv.slice(2);
  const bad = argv.find((a) => a.startsWith('-') && a !== '--telefon');
  // Noma'lum bayroq jim o'tkazilsa, odam --phone yozib kutgan o'lchamini olmagan bo'lardi.
  if (bad) fail(`noma'lum bayroq: ${bad}. Faqat --telefon bor.`);

  const phone = argv.includes('--telefon');
  const [locale = 'uz', base = 'http://localhost:3015'] = argv.filter((a) => !a.startsWith('-'));
  if (!LOCALES.includes(locale)) fail(`til noto'g'ri: "${locale}". Faqat ${LOCALES.join(', ')}.`);
  if (!ffmpeg) fail("ffmpeg-static ichida ikkilik fayl yo'q. apps/web da 'npm i' ni qayta yuriting.");

  // 1080x1350 = Instagram portret kadri, sukut 1280x720 = Telegram va YouTube.
  // Diqqat: 1080 CSS piksel keng hisoblanadi, ya'ni portret kadrda ham sahifa
  // kompyuter ko'rinishida chiziladi. Telefon ko'rinishi kerak bo'lsa bu boshqa ish.
  const size = phone ? { width: 1080, height: 1350 } : { width: 1280, height: 720 };
  // O'zbek tili sukut bo'lgani uchun manzilda prefiksi yo'q (i18n/routing.ts, localePrefix 'as-needed').
  const url = `${base.replace(/\/+$/, '')}${locale === 'uz' ? '' : `/${locale}`}/explainer`;
  const name = `explainer-${locale}-${size.width}x${size.height}`;

  mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: size,
    recordVideo: { dir: OUT, size },
    // NEGA majburan: harakat kamaytirilgan rejimda ko'rgazma taymeri umuman yurmaydi
    // (Explainer.tsx dagi useMedia), ya'ni video qimirlamas bitta kadr bo'lib chiqardi.
    reducedMotion: 'no-preference',
  });

  const page = await ctx.newPage();
  const shot = page.video();
  const started = Date.now(); // yozuv varaq ochilishi bilan boshlanadi

  const res = await page.goto(url, { waitUntil: 'load', timeout: 60_000 }).catch(() => null);
  if (!res || !res.ok()) fail(`sahifa ochilmadi: ${url}. Server ko'tarilganmi? (npx next start -p 3015)`);

  const active = page.locator('[aria-current="step"]');
  await active.waitFor({ state: 'visible', timeout: 30_000 });
  // Sahifa chizilgunicha ketgan vaqt: oxirida ffmpeg shuncha boshini kesadi, aks holda
  // videoning boshida bo'sh oq kadrlar turardi.
  const lead = (Date.now() - started) / 1000;
  const first = await active.textContent();

  // Ko'rgazma taymeri IntersectionObserver ga bog'langan: blok kadrga 35 foizdan kam
  // tushsa umuman aylanmaydi. Buni tekshirmasak 21 soniyalik qimirlamas video chiqib,
  // sababi noma'lum bo'lib qolardi.
  await page
    .waitForFunction((t) => document.querySelector('[aria-current="step"]')?.textContent !== t, first, { timeout: 9_000 })
    .catch(() => fail(`ko'rgazma aylanmadi. Kadr (${size.width}x${size.height}) blokni to'liq sig'dirmayapti bo'lishi mumkin.`));

  await page.waitForTimeout(Math.max(0, CYCLE - (Date.now() - started - lead * 1000)));

  // Video fayl aynan shu yerda yopiladi va diskka yoziladi, shundan keyingina path() ni olish mumkin.
  await ctx.close();
  const webm = join(OUT, `${name}.webm`);
  renameSync(await shot.path(), webm);

  const mp4 = join(OUT, `${name}.mp4`);
  const conv = spawnSync(ffmpeg, [
    '-y',
    '-ss', lead.toFixed(2), // kirishda kesish: boshidagi bo'sh kadrlar
    '-i', webm,
    '-r', '30', // playwright o'zgaruvchan tezlik beradi, ijtimoiy tarmoq barqarorini kutadi
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p', // telefon pleyerlari faqat shuni o'qiydi
    '-an', // ovozsiz
    '-movflags', '+faststart', // birinchi kadr tezroq ochilsin
    mp4,
  ], { stdio: 'inherit' });
  if (conv.error) fail(`ffmpeg ishga tushmadi: ${conv.error.message}`);
  if (conv.status !== 0) fail(`ffmpeg mp4 ga o'gira olmadi (kod ${conv.status}).`);

  console.log(`Tayyor: ${mp4}`);
  console.log(`Nusxa:  ${webm}`);
} catch (e) {
  console.error(`Xato: ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
