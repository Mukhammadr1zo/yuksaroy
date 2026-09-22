/**
 * Namuna ma'lumotlarni bazaga yozish va o'chirish. Nest'siz: prisma/seed/demo.ts skripti ham,
 * admin kontrolleri ham shu funksiyalarni chaqiradi, ikki xil mantiq bo'lmasin.
 *
 * Idempotent: hamma qator deterministik id bilan upsert qilinadi. So'rov raqami (no) va
 * holat kaliti (statusToken) faqat birinchi yaratishda beriladi: raqam ketma-ketlikdan
 * keladi va qayta yuklashda o'zgarmasligi kerak.
 */
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { BOOKING, REGION_CENTERS } from '@yuksaroy/domain';
import { DEMO_LISTINGS, DEMO_ORGS, DEMO_REQUESTS, DEMO_SERVICES, DEMO_SLOT_DAYS, DEMO_TERMINALS, DEMO_TERMINAL_ORGS, DEMO_TERMINAL_USERS, DEMO_USERS } from './demo-data';

export type DemoCounts = { orgs: number; users: number; listings: number; services: number; requests: number; terminals: number };
const DAY = 86_400_000;
/** Sutka bo'yi ishlamaydigan terminal uchun ish vaqti: hafta davomida 08:00-18:00. */
const WORK_HOURS = { mon: [['08:00', '18:00']], tue: [['08:00', '18:00']], wed: [['08:00', '18:00']], thu: [['08:00', '18:00']], fri: [['08:00', '18:00']], sat: [['08:00', '14:00']] };
/** User jadvalida isDemo yo'q: namuna odamlar id prefiksi bilan ajratiladi (cuid hech qachon 'demo-' bilan boshlanmaydi). */
const demoUsers = { id: { startsWith: 'demo-user-' } } as const;

export async function seedDemo(prisma: PrismaClient, now = new Date()): Promise<DemoCounts> {
  for (const o of [...DEMO_ORGS, ...DEMO_TERMINAL_ORGS]) {
    const data = { kind: o.kind, kinds: [o.kind], name: o.name, description: o.description, regionCode: o.regionCode, kycStatus: 'NONE' as const, phone: null, isDemo: true };
    await prisma.organization.upsert({ where: { id: o.id }, create: { id: o.id, slug: o.slug, ...data }, update: { slug: o.slug, ...data } });
  }
  // isActive=false: namuna telefon seriyasi kimgadir tegishli bo'lib chiqsa ham, OTP orqali kirib
  // namuna tashkilot egasi bo'lib olmasin (JwtGuard nofaol odamni qaytaradi). Katalog va bozor
  // user.isActive ni o'qimaydi, shuning uchun namuna qatorlar ko'rinaverishadi.
  for (const u of [...DEMO_USERS, ...DEMO_TERMINAL_USERS]) {
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

  await seedTerminals(prisma, now);

  for (const r of DEMO_REQUESTS) {
    const { id, loadInDays, ...rest } = r;
    // Namuna hayoti ikki shart bilan kesiladi: createdAt (30 kunlik eskirish) va yuklash sanasi.
    // Sana shu oynaga sig'ishi shart, aks holda namuna yuklar doskadan erta tushib ketadi.
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

/**
 * Tartib: avval bog'liq qatorlar (so'rov, profil, e'lon, terminal), keyin tashkilot va odam.
 * Terminalga berilgan sinov buyurtmalari ham ketadi: Order terminalga majburiy bog'langan,
 * aks holda o'chirish FK da to'xtardi. Slot, tarif va xizmat terminal bilan cascade o'chadi.
 */
export async function removeDemo(prisma: PrismaClient): Promise<DemoCounts> {
  const requests = (await prisma.marketRequest.deleteMany({ where: { isDemo: true } })).count;
  const services = (await prisma.serviceProfile.deleteMany({ where: { isDemo: true } })).count;
  const listings = (await prisma.listing.deleteMany({ where: { isDemo: true } })).count;
  await prisma.order.deleteMany({ where: { terminal: { isDemo: true } } });
  const terminals = (await prisma.terminal.deleteMany({ where: { isDemo: true } })).count;
  const orgs = (await prisma.organization.deleteMany({ where: { isDemo: true } })).count;
  const users = (await prisma.user.deleteMany({ where: demoUsers })).count;
  return { orgs, users, listings, services, requests, terminals };
}

/**
 * Namuna terminal: xizmat, tarif va slot kalendari bilan. Slot bo'lmasa "joy band qilish"
 * tugmasi bo'sh kalendarga olib borardi, ya'ni sinab ko'rib bo'lmasdi.
 * Kalendar bugundan boshlab BOOKING.horizonDays kunga ochiladi; mavjud slot tegilmaydi
 * (sig'im va bandlik saqlanadi), shuning uchun qayta yuklash bronlarni buzmaydi.
 */
async function seedTerminals(prisma: PrismaClient, now: Date): Promise<void> {
  const validFrom = new Date(now.getTime() - 86_400_000);
  for (const t of DEMO_TERMINALS) {
    // Stansiya nomi bo'yicha topiladi; reestrda bo'lmasa terminal stansiyasiz qoladi (koordinata o'zimizniki)
    const station = await prisma.station.findFirst({ where: { nameRu: t.stationRu }, select: { id: true } });
    const data = {
      orgId: t.orgId, stationId: station?.id ?? null, kind: t.kind, name: t.name, description: t.description,
      address: t.address, lat: t.lat, lng: t.lng, is24h: t.is24h, regionCode: t.regionCode, photos: t.photos,
      hours: t.is24h ? Prisma.DbNull : (WORK_HOURS as Prisma.InputJsonValue),
      passport: t.passport as unknown as Prisma.InputJsonValue,
      status: 'ACTIVE' as const, claimStatus: 'APPROVED' as const, claimedAt: now, phone: null, isDemo: true,
    };
    await prisma.terminal.upsert({ where: { id: t.id }, create: { id: t.id, slug: t.slug, ...data }, update: { slug: t.slug, ...data } });

    await prisma.terminalService.deleteMany({ where: { terminalId: t.id } });
    await prisma.terminalService.createMany({ data: t.services.map((serviceCode) => ({ terminalId: t.id, serviceCode })) });

    if ((await prisma.tariff.count({ where: { terminalId: t.id } })) === 0) {
      await prisma.tariff.createMany({
        data: t.tariffs.map((x) => ({
          terminalId: t.id, serviceCode: x.serviceCode, version: 1, validFrom,
          priceTiyin: BigInt(x.priceSom) * 100n, unit: x.unit, minTiyin: x.minSom === null ? null : BigInt(x.minSom) * 100n,
        })),
      });
    }

    for (let d = 0; d < DEMO_SLOT_DAYS; d++) {
      const date = new Date(now.getTime() + d * 86_400_000).toISOString().slice(0, 10);
      for (const [i, [start, end]] of BOOKING.defaultWindows.entries()) {
        await prisma.timeSlot.upsert({
          where: { terminalId_localDate_window: { terminalId: t.id, localDate: new Date(`${date}T00:00:00.000Z`), window: i + 1 } },
          create: {
            terminalId: t.id, localDate: new Date(`${date}T00:00:00.000Z`), window: i + 1,
            startsAt: new Date(`${date}T${start}:00.000+05:00`), endsAt: new Date(`${date}T${end}:00.000+05:00`), capacity: t.capacity,
          },
          update: {}, // mavjud sig'im va bandlik tegilmaydi
        });
      }
    }
  }
}

export async function demoStatus(prisma: PrismaClient): Promise<DemoCounts> {
  const [orgs, users, listings, services, requests, terminals] = await Promise.all([
    prisma.organization.count({ where: { isDemo: true } }),
    prisma.user.count({ where: demoUsers }),
    prisma.listing.count({ where: { isDemo: true } }),
    prisma.serviceProfile.count({ where: { isDemo: true } }),
    prisma.marketRequest.count({ where: { isDemo: true } }),
    prisma.terminal.count({ where: { isDemo: true } }),
  ]);
  return { orgs, users, listings, services, requests, terminals };
}
