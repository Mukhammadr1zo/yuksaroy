/* eslint-disable no-console */
/**
 * Namuna ma'lumotlar (isDemo=true): yuklash yoki o'chirish. Mantiq src/modules/admin/demo da,
 * admin paneli ham o'sha funksiyalarni chaqiradi.
 *   pnpm --filter @yuksaroy/api db:seed:demo            # yuklash (qayta ishga tushirish xavfsiz: upsert)
 *   pnpm --filter @yuksaroy/api db:seed:demo -- --remove # hammasini o'chirish
 */
import { PrismaClient } from '@prisma/client';
import { removeDemo, seedDemo } from '../../src/modules/admin/demo/demo-seed';

const prisma = new PrismaClient();

async function main() {
  const remove = process.argv.includes('--remove');
  const counts = remove ? await removeDemo(prisma) : await seedDemo(prisma);
  console.log(`Namuna ${remove ? "o'chirildi" : 'yuklandi'}:`, counts);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
