/**
 * Bosh sahifa telefon tasmasining statik rasmlari: public/map/strip-{uz,ru,en}.webp.
 *
 * NEGA rasm: tasma birinchi ekranda turadi, jonli xarita esa brauzer bo'shagach yuklanadi
 * (MapHero). Shu orada o'rnida aynan o'sha kadrning rasmi turadi, jonli xarita ustiga
 * chiqqanda faqat pinlar qo'shiladi.
 *
 * NEGA saytning o'z kodidan: rasm jonli xarita bilan piksel-piksel mos bo'lishi shart. Shuning
 * uchun uslub (light.json), qatlamlar va yozuvlar (mapStyle.ts: addBaseLayers, localize),
 * maplibre va worker saytdagining o'zi, faqat pinlar yo'q. Kadr MapHero dagi STRIP bilan bir xil,
 * o'lcham 574x298 @2x: tasmaning eng keng holati (36rem ustun, ramka chegarasisiz).
 *
 * Qachon qayta yuritiladi: light.json, mapStyle.ts dagi asos qatlamlari yoki yozuvlari,
 * tasma o'lchami yoki STRIP o'zgarsa. CARTO plitkalari internetdan olinadi.
 *
 * Ishlatish, apps/web ichidan:
 *   node scripts/strip-poster.mjs
 *   node scripts/strip-poster.mjs --out ../../tmp/poster   (avval boshqa papkada solishtirish uchun)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import ts from 'typescript';

const req = createRequire(import.meta.url);
// sharp apps/web ga alohida o'rnatilmagan: Next uni rasm optimallashtirish uchun o'zi olib keladi
const sharp = createRequire(req.resolve('next/package.json'))('sharp');
const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ML = dirname(req.resolve('maplibre-gl/dist/maplibre-gl.css'));

// MapHero dagi STRIP bilan bir xil bo'lishi shart
const CENTER = [65.5, 40.3];
const ZOOM = 4.5;
const W = 574, H = 298;
const at = process.argv.indexOf('--out');
const OUT = at > 0 ? resolve(process.argv[at + 1]) : join(WEB, 'public/map');

const mapStyleJs = ts.transpileModule(readFileSync(join(WEB, 'components/map/mapStyle.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

const page = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/lib/maplibre-gl.css">
<style>html,body{margin:0;background:#fff}#m{position:relative;width:${W}px;height:${H}px}</style></head>
<body><div id="m"></div><script type="module">
import { Map, setWorkerUrl } from '/lib/maplibre-gl.mjs';
import { MAX_BOUNDS, STYLE, WORKER_URL, addBaseLayers, localize } from '/mapStyle.js';
setWorkerUrl(WORKER_URL);
const loc = new URLSearchParams(location.search).get('loc');
// MapView compact bilan bir xil sozlamalar (interaktiv emas, minZoom 4.5, maxBounds)
const map = new Map({ container: 'm', style: STYLE, attributionControl: false, center: ${JSON.stringify(CENTER)}, zoom: ${ZOOM}, minZoom: 4.5, maxBounds: MAX_BOUNDS, interactive: false });
map.on('error', (e) => { window.__err = String(e.error?.message ?? e); });
map.on('load', () => { localize(map, loc); addBaseLayers(map); map.once('idle', () => { window.__done = true; }); });
</script></body></html>`;

// Saytdagi manzillar bilan bir xil: uslub, temir yo'l GeoJSON va worker public/ dan
const files = {
  '/map/light.json': join(WEB, 'public/map/light.json'),
  '/data/uz-rail-far.geojson': join(WEB, 'public/data/uz-rail-far.geojson'),
  '/maplibre/maplibre-gl-worker.mjs': join(WEB, 'public/maplibre/maplibre-gl-worker.mjs'),
  '/maplibre/maplibre-gl-shared.mjs': join(WEB, 'public/maplibre/maplibre-gl-shared.mjs'),
  '/lib/maplibre-gl.mjs': join(ML, 'maplibre-gl.mjs'),
  '/lib/maplibre-gl-shared.mjs': join(ML, 'maplibre-gl-shared.mjs'),
  '/lib/maplibre-gl.css': join(ML, 'maplibre-gl.css'),
};
const TYPES = { '.json': 'application/json', '.geojson': 'application/json', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = createServer((rq, rs) => {
  const p = new URL(rq.url, 'http://x').pathname;
  if (p === '/') { rs.writeHead(200, { 'content-type': 'text/html' }); return rs.end(page); }
  if (p === '/mapStyle.js') { rs.writeHead(200, { 'content-type': 'text/javascript' }); return rs.end(mapStyleJs); }
  const f = files[p];
  if (!f) { rs.writeHead(404); return rs.end(); }
  rs.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
  rs.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();

// swiftshader: GPU siz mashinada ham WebGL ishlaydi
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
mkdirSync(OUT, { recursive: true });
for (const loc of ['uz', 'ru', 'en']) {
  const pg = await ctx.newPage();
  pg.on('console', (m) => { if (m.type() === 'error') console.log(`[${loc}]`, m.text()); });
  await pg.goto(`http://127.0.0.1:${port}/?loc=${loc}`);
  await pg.waitForFunction(() => window.__done || window.__err, null, { timeout: 90_000 });
  // Plitka yoki glif yuklanmagan bo'lsa chala rasm yozilmaydi
  const err = await pg.evaluate(() => window.__err);
  if (err) throw new Error(`${loc}: ${err}`);
  // idle dan keyin yana bir oz: yozuvlarning paydo bo'lish animatsiyasi tugasin
  await pg.waitForTimeout(800);
  const webp = await sharp(await pg.locator('#m').screenshot()).webp({ quality: 82, effort: 6 }).toBuffer();
  writeFileSync(join(OUT, `strip-${loc}.webp`), webp);
  console.log(`strip-${loc}.webp ${(webp.length / 1024).toFixed(1)} KB`);
  await pg.close();
}
await browser.close();
server.close();
