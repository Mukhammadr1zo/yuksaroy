// Loyiha qoidasi: em/en tire va tipografik qo'shtirnoq/apostrof matnda bo'lmasin.
// Ular O'zbek lotinida noto'g'ri ko'rinadi va nusxa-ko'chirishda buziladi.
//
// Istisno faqat bitta turda bo'ladi: shu belgilarni ASCII ga o'tkazadigan normalizator
// regexlari (ular belgining o'zini saqlashi shart) va o'sha normalizatorning testi.
// Shuning uchun istisno "naqsh bo'yicha" emas, "fayl + aniq soni" bo'yicha: faylga
// yangi belgi qo'shilsa son o'zgaradi va tekshiruv yiqiladi. grep -v bilan naqsh
// yozish esa butun faylni ko'r qilib qo'yardi.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
// Belgilarni kod bilan yozamiz: aks holda tekshiruvchining o'zi tekshiruvdan o'tmaydi
const BAD = [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d].map((c) => String.fromCharCode(c));
const EXT = ['.ts', '.tsx', '.js', '.mjs', '.json', '.sql', '.prisma'];
const SKIP = new Set(['node_modules', '.next', 'dist', '.turbo', '.git', 'coverage']);
// Begona kutubxona nusxalari: bizniki emas, tahrir qilinmaydi
const VENDOR = ['apps/web/public/maplibre/'];

// Tasdiqlangan istisnolar: fayl -> shu faylda ruxsat etilgan belgilar soni.
const ALLOW = {
  'apps/api/prisma/seed/build-data.ts': 3,
  'apps/api/prisma/seed/seed.ts': 1,
  'apps/api/src/modules/catalog/infrastructure/prisma-catalog.repository.ts': 2,
  'apps/api/src/modules/search/parse-query.spec.ts': 1,
  'packages/domain/src/search.ts': 2,
  'packages/domain/src/index.ts': 1,
};

const found = new Map();
const lines = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!EXT.some((e) => name.endsWith(e))) continue;
    const rel = relative(ROOT, full).split(sep).join('/');
    if (VENDOR.some((v) => rel.startsWith(v))) continue;
    const text = readFileSync(full, 'utf8');
    let n = 0;
    text.split('\n').forEach((line, i) => {
      const hits = BAD.reduce((a, c) => a + line.split(c).length - 1, 0);
      if (!hits) return;
      n += hits;
      lines.push(`${rel}:${i + 1}: ${line.trim().slice(0, 140)}`);
    });
    if (n) found.set(rel, n);
  }
}

walk(ROOT);

const problems = [];
for (const [file, n] of found) {
  const allowed = ALLOW[file] ?? 0;
  if (n !== allowed) {
    problems.push(
      allowed === 0
        ? `${file}: ${n} ta taqiqlangan belgi`
        : `${file}: ${n} ta belgi, ruxsat ${allowed} ta (istisno o'zgargan)`,
    );
  }
}
// Ro'yxatdagi fayl o'chib ketsa yoki tozalansa, istisno ham olib tashlansin
for (const file of Object.keys(ALLOW)) {
  if (!found.has(file)) problems.push(`${file}: istisno ortiqcha, ALLOW dan o'chiring`);
}

if (problems.length) {
  for (const l of lines) console.error(l);
  console.error('');
  for (const p of problems) console.error('  ' + p);
  console.error('\nEm/en tire va tipografik apostrofni ASCII ga almashtiring: - va \' va "');
  process.exit(1);
}

console.log(`toza (${found.size} ta faylda tasdiqlangan istisno)`);
