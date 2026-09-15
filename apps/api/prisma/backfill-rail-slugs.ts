/**
 * Shahobcha terminallariga o'qiladigan slug qo'yadi.
 *
 * Ko'chirish migratsiyasi vaqtincha `shahobcha-<cuid>` qo'ygan edi, chunki SQL ichida
 * kirilldan lotinga o'tkazish yo'q. Sahifa manzili odamga ko'rinadi, shuning uchun u
 * "bekobod-shahobcha-142" bo'lishi kerak, tasodifiy id emas.
 *
 * Ishga tushirish: `npx tsx prisma/backfill-rail-slugs.ts` (DATABASE_URL kerak).
 * Qayta ishga tushirsa bo'ladi: faqat vaqtinchalik slugli qatorlarga tegadi.
 */
import { PrismaClient } from '@prisma/client';
import { slugify } from '@yuksaroy/domain';

const prisma = new PrismaClient();

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  қ: 'q', ў: 'o', ғ: 'g', ҳ: 'h',
};
const translit = (s: string) => s.toLowerCase().split('').map((c) => CYR[c] ?? c).join('');

async function main() {
  const rows = await prisma.terminal.findMany({
    where: { kind: 'RAIL', slug: { startsWith: 'shahobcha-' } },
    select: { id: true, slug: true, registryNo: true, stationNameRaw: true, station: { select: { nameUz: true } } },
    orderBy: { registryNo: 'asc' },
  });
  if (!rows.length) return console.log('Vaqtinchalik slugli qator yo\'q, hammasi tayyor.');

  // Band slugalar: boshqa terminallar ham bor, to'qnashuv bo'lmasin
  const taken = new Set((await prisma.terminal.findMany({ select: { slug: true } })).map((t) => t.slug));
  let done = 0;

  for (const r of rows) {
    const place = r.station?.nameUz ?? (r.stationNameRaw ? translit(r.stationNameRaw) : '');
    const base = [slugify(place), 'shahobcha', r.registryNo ?? ''].filter(Boolean).join('-') || 'shahobcha';
    // O'z slugi hisobga olinmaydi: aks holda hisoblangan slug allaqachon o'ziniki bo'lsa
    // skript uni band deb bilib, har ishga tushganda "-2", "-3" qo'shib ketaverardi.
    taken.delete(r.slug);
    let slug = base;
    // Bir stansiyada bir nechta yo'l bo'lishi mumkin va reestr raqami bo'sh bo'lishi mumkin
    for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
    if (slug === r.slug) { taken.add(r.slug); continue; }
    taken.add(slug);
    await prisma.terminal.update({ where: { id: r.id }, data: { slug } });
    done++;
    if (done % 200 === 0) console.log(`  ${done} / ${rows.length}`);
  }
  console.log(`Slug yangilandi: ${done} ta (jami ${rows.length}).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
