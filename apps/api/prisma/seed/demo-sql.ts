/* eslint-disable no-console */
/**
 * Namuna ma'lumotlarni SQL migratsiyasiga aylantiradi.
 *
 * Nega kerak: prod bazasi tashqaridan ochiq emas va admin tugmasi platforma egasi
 * kirishini talab qiladi. Migratsiya esa har deployda o'z-o'zidan bir marta ishlaydi,
 * ya'ni sayt bo'sh ko'rinmaydi. Qatorlar admin panelidagi "o'chirish" tugmasi bilan
 * olib tashlanadi va migratsiya qayta ishlamagani uchun ular qaytib kelmaydi.
 *
 * Mantiq demo-seed.ts bilan bir xil bo'lishi shart: shu sabab ma'lumot ham, o'girish
 * qoidasi ham o'sha fayllardan olinadi, qo'lda ko'chirilmaydi.
 *
 *   pnpm --filter @yuksaroy/api exec tsx prisma/seed/demo-sql.ts > <migration>.sql
 */
import { REGION_CENTERS } from '@yuksaroy/domain';
import { BOOKING } from '@yuksaroy/domain';
import { DEMO_LISTINGS, DEMO_ORGS, DEMO_REQUESTS, DEMO_SERVICES, DEMO_SLOT_DAYS, DEMO_TERMINALS, DEMO_TERMINAL_ORGS, DEMO_TERMINAL_USERS, DEMO_USERS } from '../../src/modules/admin/demo/demo-data';

/** SQL satri: bitta tirnoq ikkilantiriladi, boshqa hech narsa o'zgarmaydi. */
const s = (v: string) => `'${v.replace(/'/g, "''")}'`;
const or = (v: string | null | undefined) => (v == null ? 'NULL' : s(v));
const n = (v: number | null | undefined) => (v == null ? 'NULL' : String(v));
const b = (v: boolean) => (v ? 'true' : 'false');
const arr = (xs: readonly string[]) => (xs.length ? `ARRAY[${xs.map(s).join(', ')}]::TEXT[]` : `ARRAY[]::TEXT[]`);
const enumArr = (xs: readonly string[], type: string) => (xs.length ? `ARRAY[${xs.map(s).join(', ')}]::"${type}"[]` : `ARRAY[]::"${type}"[]`);
const json = (v: unknown) => (v == null ? 'NULL' : `${s(JSON.stringify(v))}::jsonb`);

const out: string[] = [];
out.push(`-- Namuna ma'lumotlar (isDemo = true): sayt bo'sh ko'rinmasligi uchun.`);
out.push(`-- Har qatorda "Namuna" belgisi chiqadi, telefon yo'q, chat va taklif yopiq.`);
out.push(`-- Admin panelidagi "Namuna ma'lumotlarni o'chirish" tugmasi bilan olib tashlanadi;`);
out.push(`-- migratsiya bir marta ishlagani uchun ular qaytib kelmaydi.`);
out.push(`-- Fayl qo'lda yozilmagan: prisma/seed/demo-sql.ts shu ma'lumotdan yasaydi.`);
out.push('');

for (const o of [...DEMO_ORGS, ...DEMO_TERMINAL_ORGS]) {
  out.push(
    `INSERT INTO "Organization" ("id", "slug", "kind", "kinds", "name", "description", "regionCode", "kycStatus", "phone", "isDemo", "createdAt", "updatedAt")\n` +
      `VALUES (${s(o.id)}, ${s(o.slug)}, ${s(o.kind)}::"OrgKind", ${enumArr([o.kind], 'OrgKind')}, ${s(o.name)}, ${s(o.description)}, ${s(o.regionCode)}, 'NONE'::"KycStatus", NULL, true, now(), now())\n` +
      `ON CONFLICT ("id") DO NOTHING;`,
  );
}
out.push('');

for (const u of [...DEMO_USERS, ...DEMO_TERMINAL_USERS]) {
  // isActive=false: namuna telefon seriyasi kimgadir tegishli bo'lsa ham, uning nomidan kirib bo'lmaydi
  out.push(
    `INSERT INTO "User" ("id", "phone", "fullName", "locale", "isActive", "createdAt", "updatedAt")\n` +
      `VALUES (${s(u.id)}, ${s(u.phone)}, ${s(u.fullName)}, 'uz', false, now(), now())\n` +
      `ON CONFLICT ("id") DO NOTHING;`,
  );
  if (u.orgId) {
    out.push(
      `INSERT INTO "Membership" ("id", "userId", "orgId", "roles", "isOwner", "createdAt")\n` +
        `VALUES (${s(`${u.id}-m`)}, ${s(u.id)}, ${s(u.orgId)}, ${enumArr([...u.roles], 'Role')}, true, now())\n` +
        `ON CONFLICT ("userId", "orgId") DO NOTHING;`,
    );
  }
}
out.push('');

for (const l of DEMO_LISTINGS) {
  const { ownerType: _o, routes, priceTiyin, ...i } = l.input;
  const owner = DEMO_USERS.find((u) => u.orgId === l.orgId);
  if (!owner) throw new Error(`egasi topilmadi: ${l.id}`);
  const c = REGION_CENTERS[i.regionCode];
  // expiresAt NULL: katalog buni "muddatsiz" deb o'qiydi, namuna e'lon o'z-o'zidan tushib qolmaydi
  out.push(
    `INSERT INTO "Listing" ("id", "slug", "orgId", "createdById", "kind", "deal", "status", "title", "description", "regionCode",\n` +
      `  "lat", "lng", "priceTiyin", "priceUnit", "photos", "year", "condition", "model", "qty", "wagonType", "capacityT",\n` +
      `  "truckType", "tonnage", "fleetSize", "serviceRegions", "routes", "contactPhone", "responseHours",\n` +
      `  "publishedAt", "expiresAt", "premiumUntil", "isDemo", "createdAt", "updatedAt")\n` +
      `VALUES (${s(l.id)}, ${s(l.slug)}, ${s(l.orgId)}, ${s(owner.id)}, ${s(i.kind)}::"ListingKind", ${i.deal ? `${s(i.deal)}::"DealKind"` : 'NULL'}, 'ACTIVE'::"ListingStatus",\n` +
      `  ${s(i.title)}, ${or(i.description)}, ${s(i.regionCode)}, ${n(c.lat)}, ${n(c.lng)}, ${priceTiyin == null ? 'NULL' : `${priceTiyin}::BIGINT`},\n` +
      `  ${i.priceUnit ? `${s(i.priceUnit)}::"PriceUnit"` : 'NULL'}, ${arr(i.photos ?? [])}, ${n(i.year)}, ${i.condition ? `${s(i.condition)}::"Condition"` : 'NULL'},\n` +
      `  ${or(i.model)}, ${n(i.qty ?? 1)}, ${or(i.wagonType)}, ${n(i.capacityT)}, ${or(i.truckType)}, ${n(i.tonnage)}, ${n(i.fleetSize)},\n` +
      `  ${arr((i.serviceRegions ?? []) as string[])}, ${json(routes)}, NULL, ${n(i.responseHours)}, now(), NULL, NULL, true, now(), now())\n` +
      // Rasm yangilanadi: prodda matnli SVG bilan yozilgan qatorlar haqiqiy suratga o'tsin
      `ON CONFLICT ("id") DO UPDATE SET "photos" = EXCLUDED."photos";`,
  );
}
out.push('');

for (const p of DEMO_SERVICES) {
  out.push(
    `INSERT INTO "ServiceProfile" ("id", "userId", "orgId", "serviceType", "title", "description", "regions",\n` +
      `  "experienceYears", "priceNote", "contactPhone", "status", "isDemo", "createdAt", "updatedAt")\n` +
      `VALUES (${s(p.id)}, ${s(p.userId)}, ${or(p.orgId)}, ${s(p.serviceType)}, ${s(p.title)}, ${s(p.description)}, ${arr(p.regions)},\n` +
      `  ${n(p.experienceYears)}, ${or(p.priceNote)}, NULL, 'ACTIVE', true, now(), now())\n` +
      `ON CONFLICT ("id") DO NOTHING;`,
  );
}
out.push('');

for (const r of DEMO_REQUESTS) {
  const { id, loadInDays, board, ...rest } = r as typeof r & Record<string, unknown>;
  const g = (k: string) => (rest as Record<string, unknown>)[k] as string | number | null | undefined;
  // Raqam ketma-ketlikdan, holat kaliti gen_random_uuid dan (PG 13+ da o'rnatilgan, kengaytma kerak emas)
  out.push(
    `INSERT INTO "MarketRequest" ("id", "no", "board", "serviceType", "regionCode", "fromRegion", "toRegion", "fromText", "toText",\n` +
      `  "cargoName", "weightT", "loadDate", "truckType", "title", "description", "contactPhone", "createdById", "orgId",\n` +
      `  "status", "awardedOfferId", "statusToken", "isDemo", "createdAt", "updatedAt")\n` +
      `VALUES (${s(id)}, ${s(board === 'CARGO' ? 'CR' : 'SR')} || '-' || nextval('market_no_seq'), ${s(board as string)},\n` +
      `  ${or(g('serviceType') as string)}, ${or(g('regionCode') as string)}, ${or(g('fromRegion') as string)}, ${or(g('toRegion') as string)},\n` +
      `  ${or(g('fromText') as string)}, ${or(g('toText') as string)}, ${or(g('cargoName') as string)}, ${n(g('weightT') as number)},\n` +
      `  ${loadInDays == null ? 'NULL' : `(CURRENT_DATE + ${loadInDays})`}, ${or(g('truckType') as string)}, ${s(g('title') as string)},\n` +
      `  ${s(g('description') as string)}, NULL, ${s(g('createdById') as string)}, ${or(g('orgId') as string)},\n` +
      `  'OPEN', NULL, replace(gen_random_uuid()::text, '-', ''), true, now(), now())\n` +
      `ON CONFLICT ("id") DO NOTHING;`,
  );
}

// ── Namuna terminallar: xizmat, tarif va slot kalendari bilan ──
const WORK_HOURS = { mon: [['08:00', '18:00']], tue: [['08:00', '18:00']], wed: [['08:00', '18:00']], thu: [['08:00', '18:00']], fri: [['08:00', '18:00']], sat: [['08:00', '14:00']] };
out.push('');
for (const t of DEMO_TERMINALS) {
  // Stansiya nomi bo'yicha topiladi; reestrda bo'lmasa NULL qoladi va terminal koordinatasi o'zinikida turaveradi
  const station = `(SELECT "id" FROM "Station" WHERE "nameRu" = ${s(t.stationRu)} LIMIT 1)`;
  out.push(
    `INSERT INTO "Terminal" ("id", "slug", "orgId", "stationId", "kind", "name", "description", "address", "phone",\n` +
      `  "lat", "lng", "is24h", "hours", "passport", "photos", "status", "claimStatus", "claimedAt", "regionCode", "isDemo", "createdAt", "updatedAt")\n` +
      `VALUES (${s(t.id)}, ${s(t.slug)}, ${s(t.orgId)}, ${station}, ${s(t.kind)}::"TerminalKind", ${s(t.name)}, ${s(t.description)}, ${s(t.address)}, NULL,\n` +
      `  ${n(t.lat)}, ${n(t.lng)}, ${b(t.is24h)}, ${t.is24h ? 'NULL' : json(WORK_HOURS)}, ${json(t.passport)}, ${arr(t.photos)},\n` +
      `  'ACTIVE'::"TerminalStatus", 'APPROVED'::"ClaimStatus", now(), ${s(t.regionCode)}, true, now(), now())\n` +
      `ON CONFLICT ("id") DO NOTHING;`,
  );
  for (const code of t.services) {
    out.push(
      `INSERT INTO "TerminalService" ("id", "terminalId", "serviceCode", "isEnabled", "leadTimeMin")\n` +
        `VALUES (${s(`${t.id}-${code.toLowerCase()}`)}, ${s(t.id)}, ${s(code)}::"ServiceCode", true, 0)\n` +
        `ON CONFLICT ("terminalId", "serviceCode") DO NOTHING;`,
    );
  }
  for (const [i, x] of t.tariffs.entries()) {
    out.push(
      `INSERT INTO "Tariff" ("id", "terminalId", "serviceCode", "version", "validFrom", "priceTiyin", "unit", "minTiyin", "note", "createdAt")\n` +
        `VALUES (${s(`${t.id}-tar-${i + 1}`)}, ${s(t.id)}, ${s(x.serviceCode)}::"ServiceCode", 1, now() - interval '1 day',\n` +
        `  ${x.priceSom * 100}::BIGINT, ${s(x.unit)}::"TariffUnit", ${x.minSom === null ? 'NULL' : `${x.minSom * 100}::BIGINT`}, NULL, now())\n` +
        `ON CONFLICT ("terminalId", "serviceCode", "version") DO NOTHING;`,
    );
  }
  // Kalendar: bugundan DEMO_SLOT_DAYS kunga, har kuni BOOKING.defaultWindows oynalari.
  // Vaqt Toshkent bo'yicha yoziladi va UTC ga o'giriladi (AT TIME ZONE), ya'ni yozgi/qishgi farq yo'q.
  const windows = BOOKING.defaultWindows.map(([from, to], i) => `(${i + 1}, ${s(from)}, ${s(to)})`).join(', ');
  out.push(
    `INSERT INTO "TimeSlot" ("id", "terminalId", "localDate", "window", "startsAt", "endsAt", "capacity", "createdAt", "updatedAt")\n` +
      `SELECT replace(gen_random_uuid()::text, '-', ''), ${s(t.id)}, d::date, w.win,\n` +
      `       ((d::date + w.a::time) AT TIME ZONE 'Asia/Tashkent'), ((d::date + w.b::time) AT TIME ZONE 'Asia/Tashkent'), ${t.capacity}, now(), now()\n` +
      `FROM generate_series(CURRENT_DATE, CURRENT_DATE + ${DEMO_SLOT_DAYS - 1}, interval '1 day') d\n` +
      `CROSS JOIN (VALUES ${windows}) AS w(win, a, b)\n` +
      `ON CONFLICT ("terminalId", "localDate", "window") DO NOTHING;`,
  );
  out.push('');
}

console.log(out.join('\n'));
