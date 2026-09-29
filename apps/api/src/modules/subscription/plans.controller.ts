import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { PLAN_LIMIT_KEYS, PLAN_LOCALES, SUBSCRIPTION_GRANTS } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { catalogView, planLimit, SubscriptionService } from './subscription.service';

/**
 * Tarif: nomi va tavsifi uch tilda, narxi, nimani ochishi va chegaralari.
 *
 * Matn bazada, tarjima faylida emas: adminning formaga yozgan gapini tarjima tizimi
 * tarjima qila olmaydi. Shuning uchun nom {uz, ru, en}, tavsif esa har tilda satrlar
 * ro'yxati bo'lib saqlanadi.
 */
class PlanDto {
  @IsString() @Matches(/^[a-z0-9-]{2,30}$/, { message: 'code: kichik lotin, raqam va defis' }) code!: string;
  @IsInt() @Min(0) priceMonthSom!: number;
  @IsOptional() @IsInt() @Min(1) @Max(12) maxMonths?: number;
  @IsOptional() @IsInt() sort?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  /** { uz, ru, en } */
  name!: unknown;
  /** { uz: [...], ru: [...], en: [...] } */
  features!: unknown;
  /** SUBSCRIPTION_GRANTS dan kamida bittasi */
  grants!: unknown;
  /** PLAN_LIMIT_KEYS dagi kalitlar; PHONE ruxsati bilan phoneRevealDaily majburiy */
  @IsOptional() limits?: unknown;
}
class PlanPatchDto {
  @IsOptional() @IsInt() @Min(0) priceMonthSom?: number;
  @IsOptional() @IsInt() @Min(1) @Max(12) maxMonths?: number;
  @IsOptional() @IsInt() sort?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() name?: unknown;
  @IsOptional() features?: unknown;
  @IsOptional() grants?: unknown;
  @IsOptional() limits?: unknown;
}

const str = (v: unknown, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** Uch tilning hammasi to'ldirilishi shart: bitta til bo'sh qolsa o'sha tilda tarif nomsiz chiqardi. */
function checkName(v: unknown): Record<string, string> {
  const o = v as Record<string, unknown>;
  if (!o || typeof o !== 'object' || !PLAN_LOCALES.every((l) => str(o[l], 80))) {
    throw new BadRequestException({ code: 'PLAN_NAME', locales: PLAN_LOCALES });
  }
  return Object.fromEntries(PLAN_LOCALES.map((l) => [l, String(o[l]).trim()]));
}

/** Tavsif satrlari: har tilda 1 dan 8 tagacha qator. */
function checkFeatures(v: unknown): Record<string, string[]> {
  const o = v as Record<string, unknown>;
  const ok = o && typeof o === 'object' && PLAN_LOCALES.every((l) => {
    const a = o[l];
    return Array.isArray(a) && a.length >= 1 && a.length <= 8 && a.every((x) => str(x, 200));
  });
  if (!ok) throw new BadRequestException({ code: 'PLAN_FEATURES', locales: PLAN_LOCALES });
  return Object.fromEntries(PLAN_LOCALES.map((l) => [l, (o[l] as string[]).map((x) => x.trim())]));
}

/** Ruxsatlar oq ro'yxatdan: admin yangi imkoniyat o'ylab topa olmaydi. */
function checkGrants(v: unknown): string[] {
  const a = Array.isArray(v) ? [...new Set(v)] : [];
  if (!a.length || !a.every((g) => (SUBSCRIPTION_GRANTS as readonly string[]).includes(String(g)))) {
    throw new BadRequestException({ code: 'PLAN_GRANTS', allowed: SUBSCRIPTION_GRANTS });
  }
  return a.map(String);
}

/** Chegaralar ham oq ro'yxatdan, qiymati musbat butun son. */
function checkLimits(v: unknown): Record<string, number> | null {
  if (v === undefined || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o !== 'object') throw new BadRequestException({ code: 'PLAN_LIMITS', allowed: PLAN_LIMIT_KEYS });
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(o)) {
    if (!(PLAN_LIMIT_KEYS as readonly string[]).includes(k)) throw new BadRequestException({ code: 'PLAN_LIMITS', allowed: PLAN_LIMIT_KEYS, key: k });
    if (!Number.isInteger(val) || (val as number) < 0) throw new BadRequestException({ code: 'PLAN_LIMITS', key: k });
    out[k] = val as number;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Telefon ruxsati kunlik sonsiz sotilmaydi: son tarifda yo'q bo'lsa devor ham, karta
 * ham nechta raqam ochilishini ayta olmasdi (sozlamada bu son endi yo'q).
 */
function checkPhoneLimit(grants: string[], limits: unknown) {
  if (grants.includes('PHONE') && planLimit(limits, 'phoneRevealDaily', 0) <= 0) throw new BadRequestException({ code: 'PLAN_PHONE_LIMIT' });
}

/** Ommaviy: sotuvdagi tariflar. Kirish shart emas, narxlar sahifasi ham shundan oladi. */
@ApiTags('subscription')
@Controller('subscription/plans')
export class PlansPublicController {
  constructor(private readonly subs: SubscriptionService) {}

  @Get()
  async list() {
    // Xizmatning keshi: buyurtma va devor ham aynan shu ro'yxatga qaraydi
    return { plans: (await this.subs.activePlans()).map(catalogView) };
  }
}

/**
 * Tariflarni boshqarish: admin ham, moderator ham.
 *
 * Egasi shuni so'radi: tarifni panelning o'zidan mustaqil yaratish kerak. Narx ham shu
 * yerda, ya'ni moderator uni o'zgartira oladi; har o'zgarish auditga yoziladi va kim
 * qachon nimani o'zgartirgani ko'rinib turadi.
 */
@ApiTags('subscription')
@ApiCookieAuth('ys_access')
@Controller('admin/plans')
@UseGuards(JwtGuard, PlatformAdminGuard)
export class PlansAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly subs: SubscriptionService,
  ) {}

  @Get()
  list() {
    return this.prisma.plan.findMany({ orderBy: [{ sort: 'asc' }, { code: 'asc' }], take: 50 });
  }

  @Post()
  async create(@CurrentUserId() userId: string, @Body() dto: PlanDto) {
    const data = {
      code: dto.code,
      name: checkName(dto.name),
      features: checkFeatures(dto.features),
      grants: checkGrants(dto.grants),
      limits: checkLimits(dto.limits) ?? undefined,
      priceMonthSom: dto.priceMonthSom,
      maxMonths: dto.maxMonths ?? 12,
      sort: dto.sort ?? 0,
      active: dto.active ?? true,
    };
    checkPhoneLimit(data.grants, data.limits);
    const p = await this.prisma.plan.create({ data });
    this.subs.invalidatePlans();
    await this.audit.log({ actorId: userId, action: 'admin.plan.create', entity: 'Plan', entityId: p.id, meta: { code: p.code, priceMonthSom: p.priceMonthSom, grants: p.grants } });
    return p;
  }

  @Patch(':id')
  async update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: PlanPatchDto) {
    const cur = await this.prisma.plan.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException({ code: 'PLAN_NOT_FOUND' });
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = checkName(dto.name);
    if (dto.features !== undefined) data.features = checkFeatures(dto.features);
    if (dto.grants !== undefined) data.grants = checkGrants(dto.grants);
    if (dto.limits !== undefined) data.limits = checkLimits(dto.limits);
    for (const k of ['priceMonthSom', 'maxMonths', 'sort', 'active'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    // Qoida yangilangan qatorga qaraydi: faqat ruxsat o'zgarsa ham, faqat son o'zgarsa ham
    const next = (data.grants as string[] | undefined) ?? cur.grants;
    checkPhoneLimit(next, dto.limits !== undefined ? data.limits : cur.limits);
    // Sotuvdan ketayotgan ruxsatlar: tarif yopilsa hammasi, ruxsat qisqarsa tushib qolgani
    const lost = !cur.active ? [] : dto.active === false ? cur.grants : cur.grants.filter((g) => !next.includes(g));
    const p = await this.guarded(id, lost, (tx) => tx.plan.update({ where: { id }, data }));
    this.subs.invalidatePlans();
    // Narx o'zgarishi alohida ko'rinadi: pulga tegadigan yagona maydon
    await this.audit.log({
      actorId: userId, action: 'admin.plan.update', entity: 'Plan', entityId: id,
      meta: { fields: Object.keys(data), ...(dto.priceMonthSom !== undefined ? { wasPrice: cur.priceMonthSom, nowPrice: dto.priceMonthSom } : {}) },
    });
    return p;
  }

  /**
   * O'chirish tarifni sotuvdan olib tashlaydi, lekin olingan obunalarga tegmaydi:
   * ularning ruxsati va chegarasi o'z qatoriga ko'chirib yozilgan.
   */
  @Delete(':id')
  async remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    const p = await this.prisma.plan.findUnique({ where: { id } });
    if (!p) throw new NotFoundException({ code: 'PLAN_NOT_FOUND' });
    await this.guarded(id, p.active ? p.grants : [], (tx) => tx.plan.delete({ where: { id } }));
    this.subs.invalidatePlans();
    await this.audit.log({ actorId: userId, action: 'admin.plan.delete', entity: 'Plan', entityId: id, meta: { code: p.code } });
    return { id, deleted: true };
  }

  /**
   * Ruxsatni ochadigan oxirgi faol tarif sotuvdan olinmaydi: narx endi faqat tarifda,
   * tarifsiz o'sha ruxsatga obuna sotib bo'lmay qoladi va devor zaxira sonni ko'rsatib
   * turadi. Umumiy son emas, har ruxsat alohida: vagon tarifi qolgani bilan telefon
   * raqami o'rnidagi taklifga urilgan odam sotib oladigan tarif bo'lmasdi.
   *
   * Sanoq va yozuv bitta Serializable tranzaksiyada (order() uslubi): ikki admin oxirgi
   * ikki tarifni bir vaqtda olsa ikkalasi ham "yana bittasi bor" deb ko'rib o'tardi.
   * `lost` bo'sh bo'lsa (narx yoki nom o'zgarishi) tranzaksiya kerak emas.
   */
  private async guarded<T>(id: string, lost: string[], write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (!lost.length) return write(this.prisma);
    try {
      return await this.prisma.$transaction(async (tx) => {
        for (const g of lost) {
          if ((await tx.plan.count({ where: { active: true, id: { not: id }, grants: { has: g } } })) === 0) throw new ConflictException({ code: 'LAST_PLAN', grant: g });
        }
        return write(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      // Poygada yiqilgan ikkinchi admin ham xuddi shu javobni oladi: qayta urinsa sanoq to'g'ri chiqadi
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') throw new ConflictException({ code: 'LAST_PLAN' });
      throw e;
    }
  }
}

/** Sinov uchun ochiq: tekshiruvchilar alohida testdan o'tadi. */
export const planChecks = { checkName, checkFeatures, checkGrants, checkLimits };



