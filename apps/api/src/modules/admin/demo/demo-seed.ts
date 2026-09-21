/**
 * Namuna ma'lumotlarni bazaga yozish va o'chirish. Nest'siz: prisma/seed/demo.ts skripti ham,
 * admin kontrolleri ham shu funksiyalarni chaqiradi, ikki xil mantiq bo'lmasin.
 *
 * Idempotent: hamma qator deterministik id bilan upsert qilinadi. So'rov raqami (no) va
 * holat kaliti (statusToken) faqat birinchi yaratishda beriladi: raqam ketma-ketlikdan
 * keladi va qayta yuklashda o'zgarmasligi kerak.
 */
import { randomBytes } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { REGION_CENTERS } from '@yuksaroy/domain';
import { DEMO_LISTINGS, DEMO_ORGS, DEMO_REQUESTS, DEMO_SERVICES, DEMO_USERS } from './demo-data';

export type DemoCounts = { orgs: number; users: number; listings: number; services: number; requests: number };
const DAY = 86_400_000;
/** User jadvalida isDemo yo'q: namuna odamlar id prefiksi bilan ajratiladi (cuid hech qachon 'demo-' bilan boshlanmaydi). */
const demoUsers = { id: { startsWith: 'demo-user-' } } as const;

export async function seedDemo(prisma: PrismaClient, now = new Date()): Promise<DemoCounts> {
  for (const o of DEMO_ORGS) {
    const data = { kind: o.kind, kinds: [o.kind], name: o.name, description: o.description, regionCode: o.regionCode, kycStatus: 'NONE' as const, phone: null, isDemo: true };
    await prisma.organization.upsert({ where: { id: o.id }, create: { id: o.id, slug: o.slug, ...data }, update: { slug: o.slug, ...data } });
  }
  // isActive=false: namuna telefon seriyasi kimgadir tegishli bo'lib chiqsa ham, OTP orqali kirib
  // namuna tashkilot egasi bo'lib olmasin (JwtGuard nofaol odamni qaytaradi). Katalog va bozor
  // user.isActive ni o'qimaydi, shuning uchun namuna qatorlar ko'rinaverishadi.
  for (const u of DEMO_USERS) {
    const data = { phone: u.phone, fullName: u.fullName, locale: 'uz', isActive: false, passwordHash: null };
    await prisma.user.upsert({ where: { id: u.id }, create: { id: u.id, ...data }, update: data });
    if (u.orgId) {
      await prisma.membership.upsert({
        where: { userId_orgId: { userId: u.id, orgId: u.orgId } },
        create: { userId: u.id, orgId: u.orgId, roles: [...u.roles], isOwner: true },
        update: { roles: [...u.roles], isOwner: true },
      });
    }
  }

  // Muddatsiz (expiresAt=null, katalog buni "tugamaydi" deb o'qiydi): namuna e'lon 90 kundan keyin
  // o'z-o'zidan tushib qolmasin, chunki hech kim qayta yuklashni eslab qolmaydi
  for (const l of DEMO_LISTINGS) {
    const { ownerType: _o, routes, priceTiyin, ...input } = l.input;
    const owner = DEMO_USERS.find((u) => u.orgId === l.orgId)!;
    const center = REGION_CENTERS[l.input.regionCode];
    const data = {
      ...input, routes: routes as unknown as Prisma.InputJsonValue, priceTiyin: priceTiyin === null ? null : BigInt(priceTiyin),
      slug: l.slug, orgId: l.orgId, lat: center.lat, lng: center.lng, status: 'ACTIVE' as const, expiresAt: null, premiumUntil: null, isDemo: true,
    };
    await prisma.listing.upsert({ where: { id: l.id }, create: { id: l.id, createdById: owner.id, publishedAt: now, ...data }, update: data });
  }

  for (const s of DEMO_SERVICES) {
    const { id, ...data } = s;
    await prisma.serviceProfile.upsert({ where: { id }, create: { id, ...data, status: 'ACTIVE', contactPhone: null, isDemo: true }, update: { ...data, status: 'ACTIVE', contactPhone: null, isDemo: true } });
  }

  for (const r of DEMO_REQUESTS) {
    const { id, loadInDays, ...rest } = r;
    // Yuklash sanasi doim kelajakda va createdAt ham bugun: bozor 30 kundan eski so'rovni ko'rsatmaydi,
    // qayta yuklash namuna so'rovlarni doskaga qaytarishi kerak
    const data = { ...rest, loadDate: loadInDays === null ? null : new Date(now.getTime() + loadInDays * DAY), createdAt: now, contactPhone: null, status: 'OPEN', awardedOfferId: null, isDemo: true };
    const exists = await prisma.marketRequest.findUnique({ where: { id }, select: { id: true } });
    if (exists) { await prisma.marketRequest.update({ where: { id }, data }); continue; }
    const [{ nextval }] = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('market_no_seq')`;
    await prisma.marketRequest.create({
      data: { id, ...data, no: `${r.board === 'CARGO' ? 'CR' : 'SR'}-${Number(nextval)}`, statusToken: randomBytes(16).toString('hex') },
    });
  }
  return demoStatus(prisma);
}

/** Tartib: avval bog'liq qatorlar (so'rov, profil, e'lon), keyin tashkilot va odam. Takliflar so'rov bilan o'chadi (cascade). */
export async function removeDemo(prisma: PrismaClient): Promise<DemoCounts> {
  const requests = (await prisma.marketRequest.deleteMany({ where: { isDemo: true } })).count;
  const services = (await prisma.serviceProfile.deleteMany({ where: { isDemo: true } })).count;
  const listings = (await prisma.listing.deleteMany({ where: { isDemo: true } })).count;
  const orgs = (await prisma.organization.deleteMany({ where: { isDemo: true } })).count;
  const users = (await prisma.user.deleteMany({ where: demoUsers })).count;
  return { orgs, users, listings, services, requests };
}

export async function demoStatus(prisma: PrismaClient): Promise<DemoCounts> {
  const [orgs, users, listings, services, requests] = await Promise.all([
    prisma.organization.count({ where: { isDemo: true } }),
    prisma.user.count({ where: demoUsers }),
    prisma.listing.count({ where: { isDemo: true } }),
    prisma.serviceProfile.count({ where: { isDemo: true } }),
    prisma.marketRequest.count({ where: { isDemo: true } }),
  ]);
  return { orgs, users, listings, services, requests };
}
