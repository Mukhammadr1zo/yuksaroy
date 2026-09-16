// Uch til (uz/ru/en) bir xil kalitlarga ega bo'lishi shart.
// Bittasida yo'q kalit next-intl da ishlash paytida yiqiladi, shuning uchun CI da ushlanadi.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'apps/web/messages';
const LANGS = ['uz', 'ru', 'en'];

const keys = (o, pre = '') => {
  const out = new Set();
  for (const [k, v] of Object.entries(o)) {
    out.add(pre + k);
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const x of keys(v, `${pre}${k}.`)) out.add(x);
  }
  return out;
};
const load = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Har til uchun: ildiz <lang>.json + <lang>/*.json bo'laklari
const files = readdirSync(join(ROOT, 'uz')).filter((f) => f.endsWith('.json'));
let bad = 0;

for (const name of [...files, 'ROOT']) {
  const sets = {};
  for (const L of LANGS) {
    const p = name === 'ROOT' ? join(ROOT, `${L}.json`) : join(ROOT, L, name);
    if (!existsSync(p)) { console.error(`YO'Q FAYL: ${p}`); bad++; continue; }
    sets[L] = keys(load(p));
  }
  if (Object.keys(sets).length !== LANGS.length) continue;
  for (const L of ['ru', 'en']) {
    const missing = [...sets.uz].filter((k) => !sets[L].has(k));
    const extra = [...sets[L]].filter((k) => !sets.uz.has(k));
    if (missing.length || extra.length) {
      bad++;
      console.error(`${name} [${L}]`);
      if (missing.length) console.error(`  uz da bor, ${L} da yo'q: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` (+${missing.length - 10})` : ''}`);
      if (extra.length) console.error(`  ${L} da bor, uz da yo'q: ${extra.slice(0, 10).join(', ')}${extra.length > 10 ? ` (+${extra.length - 10})` : ''}`);
    }
  }
}

if (bad) { console.error(`\n${bad} ta parite muammosi`); process.exit(1); }
console.log(`uz/ru/en pariteti: ${files.length + 1} fayl, muammo yo'q`);
