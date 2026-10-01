/**
 * Ko'rgazmani (explainer) yoki o'z reklamamizni (banner) brauzerda ochib videoga oladi.
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
 *   node scripts/explainer-video.mjs uz --banner
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';
import { chromium } from 'playwright';

const LOCALES = ['uz', 'ru', 'en'];
// Besh qadam x 4000 ms = 20 s bir aylanish (Explainer.tsx dagi STEP_MS), ustiga bir soniya
// zaxira: oxirgi qadam to'liq ko'rinib, ko'rgazma boshiga qaytgani bilinsin.
const CYCLE = 21_000;
// Pastki banner 4 soniya: SelfAd.tsx dagi harakat davri ham shuncha va AdSlot videoni
// loop bilan qo'yadi, ya'ni qisqa fayl o'zi qaytadan boshlanadi.
const BANNER_MS = 4_000;
// Egasi panelga yuklaydigan fayl uchun yuqori chegara: shundan oshsa ogohlantiriladi.
const BANNER_KB = 300;
const FLAGS = ['--telefon', '--banner'];
// Chiqish papkasi skript joyiga bog'langan, cwd ga emas: reponing istalgan yeridan chaqirilsin.
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.video');

const fail = (msg) => { throw new Error(msg); };

let browser;
try {
  const argv = process.argv.slice(2);
  const bad = argv.find((a) => a.startsWith('-') && !FLAGS.includes(a));
  // Noma'lum bayroq jim o'tkazilsa, odam --phone yozib kutgan o'lchamini olmagan bo'lardi.
  if (bad) fail(`noma'lum bayroq: ${bad}. Faqat ${FLAGS.join(', ')} bor.`);

  const phone = argv.includes('--telefon');
  const banner = argv.includes('--banner');
  // Ikkovi birga berilsa qaysi o'lcham kerakligi noma'lum: bannerning nisbati qat'iy 8:1.
  if (phone && banner) fail("--telefon va --banner birga ishlamaydi: banner o'lchami qat'iy 1200x150.");
  const [locale = 'uz', base = 'http://localhost:3015'] = argv.filter((a) => !a.startsWith('-'));
  if (!LOCALES.includes(locale)) fail(`til noto'g'ri: "${locale}". Faqat ${LOCALES.join(', ')}.`);
  if (!ffmpeg) fail("ffmpeg-static ichida ikkilik fayl yo'q. apps/web da 'npm i' ni qayta yuriting.");

  // 1080x1350 = Instagram portret kadri, sukut 1280x720 = Telegram va YouTube.
  // Diqqat: 1080 CSS piksel keng hisoblanadi, ya'ni portret kadrda ham sahifa
  // kompyuter ko'rinishida chiziladi. Telefon ko'rinishi kerak bo'lsa bu boshqa ish.
  // 1200x150 = 8:1 pastki banner, boshqa ikkovi ko'rgazma uchun.
  const size = banner ? { width: 1200, height: 150 } : phone ? { width: 1080, height: 1350 } : { width: 1280, height: 720 };
  // O'zbek tili sukut bo'lgani uchun manzilda prefiksi yo'q (i18n/routing.ts, localePrefix 'as-needed').
  const url = `${base.replace(/\/+$/, '')}${locale === 'uz' ? '' : `/${locale}`}/explainer${banner ? '/banner' : ''}`;
  const name = `${banner ? 'self-ad' : 'explainer'}-${locale}-${size.width}x${size.height}`;

  mkdirSync(OUT, { recursive: true });
  // channel: 'chromium' - TO'LIQ brauzer, sukut bo'lgan "headless shell" emas.
  // Sabab: videoga olish (recordVideo) faqat to'liq brauzerda ishlaydi, shell esa
  // varaq ochilishida yiqiladi ("Target crashed") va sababi tushunarsiz bo'lib qoladi.
  browser = await chromium.launch({ channel: 'chromium' });
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

  // Banner sahifasida qadam tugmasi yo'q, shuning uchun kutiladigan belgi boshqa.
  const active = page.locator(banner ? '[data-self-ad]' : '[aria-current="step"]');
  await active.waitFor({ state: 'visible', timeout: 30_000 });
  // Sahifa chizilgunicha ketgan vaqt: oxirida ffmpeg shuncha boshini kesadi, aks holda
  // videoning boshida bo'sh oq kadrlar turardi.
  const lead = (Date.now() - started) / 1000;
  // Bannerda tekshiriladigan aylanish yo'q: harakatni CSS yuritadi, ya'ni taymer ham,
  // IntersectionObserver ham ishtirok etmaydi va qadam matni o'zgarmaydi.
  if (!banner) {
    const first = await active.textContent();
    // Ko'rgazma taymeri IntersectionObserver ga bog'langan: blok kadrga 35 foizdan kam
    // tushsa umuman aylanmaydi. Buni tekshirmasak 21 soniyalik qimirlamas video chiqib,
    // sababi noma'lum bo'lib qolardi.
    await page
      .waitForFunction((t) => document.querySelector('[aria-current="step"]')?.textContent !== t, first, { timeout: 9_000 })
      .catch(() => fail(`ko'rgazma aylanmadi. Kadr (${size.width}x${size.height}) blokni to'liq sig'dirmayapti bo'lishi mumkin.`));
  }

  const span = banner ? BANNER_MS : CYCLE;
  await page.waitForTimeout(Math.max(0, span - (Date.now() - started - lead * 1000)));

  // Video fayl aynan shu yerda yopiladi va diskka yoziladi, shundan keyingina path() ni olish mumkin.
  await ctx.close();
  const webm = join(OUT, `${name}.webm`);
  renameSync(await shot.path(), webm);

  const mp4 = join(OUT, `${name}.mp4`);
  const conv = spawnSync(ffmpeg, [
    '-y',
    '-ss', lead.toFixed(2), // kirishda kesish: boshidagi bo'sh kadrlar
    '-i', webm,
    ...(banner ? ['-t', (BANNER_MS / 1000).toFixed(0)] : []), // bannerda uzunlik qat'iy: loop joyi siljimasin
    '-r', '30', // playwright o'zgaruvchan tezlik beradi, ijtimoiy tarmoq barqarorini kutadi
    '-c:v', 'libx264',
    // Bannerda sekinroq preset va yuqoriroq crf: kadr kichik va deyarli qimirlamaydi,
    // ya'ni sifat sezilmay 300 KB chegarasi ostida qoladi.
    '-preset', banner ? 'slow' : 'veryfast',
    '-crf', banner ? '26' : '20',
    '-pix_fmt', 'yuv420p', // telefon pleyerlari faqat shuni o'qiydi
    '-an', // ovozsiz
    '-movflags', '+faststart', // birinchi kadr tezroq ochilsin
    mp4,
  ], { stdio: 'inherit' });
  if (conv.error) fail(`ffmpeg ishga tushmadi: ${conv.error.message}`);
  if (conv.status !== 0) fail(`ffmpeg mp4 ga o'gira olmadi (kod ${conv.status}).`);

  const kb = Math.round(statSync(mp4).size / 1024);
  console.log(`Tayyor: ${mp4} (${kb} KB)`);
  console.log(`Nusxa:  ${webm}`);
  // Hajmni odam o'zi tekshirmasin: panelga yuklanadigan fayl chegaradan oshsa shu yerda aytiladi.
  if (banner && kb > BANNER_KB) console.warn(`Diqqat: ${BANNER_KB} KB dan oshdi (${kb} KB). crf ni oshiring (26 dan 30 ga).`);
} catch (e) {
  console.error(`Xato: ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
