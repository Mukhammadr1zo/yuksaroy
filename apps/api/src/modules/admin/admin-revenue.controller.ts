import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import { uzLocalToUtc } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { CSV_MAX, sendCsv, type CsvCols } from '../../common/csv';
import { PrismaService } from '../../common/prisma.service';
import { clampInt, pickIn } from '../catalog/presentation/catalog.controller';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';
import { REMIND_ACTION, remindBlockedAt, remindDayStart } from '../subscription/remind-manual';
import { mergeMonths, snapshot, subscriptionMonths, type RevenueRow } from './money';
import { monthBack, monthKey, monthlyRevenue } from './revenue';

const DAY = 86_400_000;
const EXPIRING_DAYS = ['7', '14', '30'] as const;
const REFUND_KINDS = ['revoke', 'cancel'] as const;

type Person = { id: string; fullName: string | null; phone: string | null };
type Expiring = {
  id: string; no: string; months: number; amountTiyin: number; endsAt: Date; remindedAt: Date | null; lastManualAt: Date | null; remindedToday: boolean;
  user: Person; plan: { code: string; name: Record<string, string> } | null;
};
type ReconcileRaw = { id: string; at: Date; subscriptionId: string; actorId: string | null; no: string | null; userId: string | null; expected: bigint | null; received: bigint | null; payref: string | null };
type Reconcile = { id: string; at: Date; subscriptionId: string; no: string | null; user: Person | null; expectedTiyin: number | null; receivedTiyin: number | null; payRef: string | null; actor: Person | null };
type Refund = {
  id: string; at: Date; action: 'subscription.revoke' | 'subscription.cancel'; subscriptionId: string; no: string | null; amountTiyin: number | null;
  moneyReceived: boolean | null; reason: string | null; wasEndsAt: string | null; user: Person | null; actor: Person | null;
};

/** BigInt JSON ga chiqmaydi: hamma pul Number tiyin. */
const num = (v: bigint | null | undefined) => (v == null ? null : Number(v));
const som = (t: number | null) => (t == null ? null : t / 100);

const MONTHS_CSV: CsvCols<RevenueRow> = {
  month: (r) => r.month, totalSom: (r) => r.totalTiyin / 100, subsSom: (r) => r.subsTiyin / 100, premiumSom: (r) => r.premiumTiyin / 100,
  payments: (r) => r.payments, renewals: (r) => r.renewals, mrrSom: (r) => r.mrrTiyin / 100,
  activeUsers: (r) => r.activeUsers, newUsers: (r) => r.newUsers, churnedUsers: (r) => r.churnedUsers,
};
const EXPIRING_CSV: CsvCols<Expiring> = {
  no: (r) => r.no, endsAt: (r) => r.endsAt, userName: (r) => r.user.fullName, phone: (r) => r.user.phone, plan: (r) => r.plan?.code ?? null,
  months: (r) => r.months, amountSom: (r) => r.amountTiyin / 100, remindedAt: (r) => r.remindedAt, lastManualAt: (r) => r.lastManualAt,
};
const RECONCILE_CSV: CsvCols<Reconcile> = {
  confirmedAt: (r) => r.at, no: (r) => r.no, userName: (r) => r.user?.fullName ?? null, phone: (r) => r.user?.phone ?? null,
  expectedSom: (r) => som(r.expectedTiyin), receivedSom: (r) => som(r.receivedTiyin),
  diffSom: (r) => (r.expectedTiyin == null || r.receivedTiyin == null ? null : (r.receivedTiyin - r.expectedTiyin) / 100),
  payRef: (r) => r.payRef, operator: (r) => r.actor?.fullName ?? r.actor?.phone ?? null,
};
const REFUNDS_CSV: CsvCols<Refund> = {
  at: (r) => r.at, action: (r) => r.action, no: (r) => r.no, userName: (r) => r.user?.fullName ?? null, phone: (r) => r.user?.phone ?? null,
  amountSom: (r) => som(r.amountTiyin), moneyReceived: (r) => r.moneyReceived, reason: (r) => r.reason, actor: (r) => r.actor?.fullName ?? r.actor?.phone ?? null,
};

/**
 * Pul 3.0, faqat ega: takroriy pul (MRR), tugayotganlar, bank bilan solishtiruv, bekorlar.
 *
 * Nega alohida kontroller: admin-system.controller.ts umumiy admin qobig'i (operator ham kiradi),
 * pul esa butunlay eganiki. Guard sinf darajasida (team kontrolleri odati): birorta yo'lni
 * ochiq qoldirib bo'lmaydi.
 */
@ApiTags('admin')
@ApiCookieAuth('ys_access')
@Controller('admin/revenue')
@UseGuards(JwtGuard, PlatformOwnerGuard)
export class AdminRevenueController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Umumiy: 12 oylik tushum (monthlyRevenue) va MRR/faol/yangi/ketgan (money.ts) bitta varaqda.
   *
   * Obuna pool bitta: to'langan va endsAt 12 oy oldingi oy boshidan keyin. Tushum ustunlari
   * ham shundan (paidAt <= endsAt, ya'ni oxirgi 12 oyda to'langan qator poolda bor): MRR va
   * tushum bir to'plamdan hisoblanadi, ikkisi bir-biriga zid chiqmaydi. Premium bugungidek.
   * ponytail: pool xotirada, take 20000; yuz minglab to'lovchi bo'lsa SQL ga o'tadi.
   */
  @Get()
  async overview(@CurrentUserId() userId: string, @Query('format') format?: string, @Res({ passthrough: true }) reply?: FastifyReply) {
    const now = new Date();
    const [pool, prems] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { paidAt: { not: null }, endsAt: { gte: uzLocalToUtc(`${monthBack(monthKey(now), 12)}-01`, '00:00') } },
        select: { userId: true, paidAt: true, startsAt: true, endsAt: true, amountTiyin: true, months: true },
        orderBy: { endsAt: 'desc' },
        take: 20_000,
      }),
      // 400 kun: 12 to'liq oy chetidan chiqmasin; orderBy majburiy, chegara eng ESKI qatorlarni tashlasin
      this.prisma.premiumOrder.findMany({ where: { paidAt: { gte: new Date(now.getTime() - 400 * DAY) } }, select: { paidAt: true, amountTiyin: true }, orderBy: { paidAt: 'desc' }, take: 5000 }),
    ]);
    const months = mergeMonths(monthlyRevenue(pool, prems, now), subscriptionMonths(pool, now));
    if (format === 'csv') {
      return sendCsv({ reply: reply!, audit: this.audit, actorId: userId, resource: 'revenue-months', filters: {}, total: months.length, rows: async () => months, cols: MONTHS_CSV });
    }
    return { now: snapshot(pool, now), months };
  }

  /**
   * Tugayotganlar: `days` kun ichida tugaydigan faol obunalar, uzaytirgan odam chetda
   * (expiry-reminder.ts qoidasi: keyingi obunasi oynadan nariga o'tgan bo'lsa hodisa emas).
   * Qo'lda eslatma auditdan, bugungi belgi remindBlockedAt bilan (server bilan bir xil qoida).
   */
  @Get('expiring')
  async expiring(
    @CurrentUserId() userId: string,
    @Query('days') daysQ?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) reply?: FastifyReply,
  ) {
    const days = Number(pickIn(daysQ, EXPIRING_DAYS) ?? '7');
    const now = new Date();
    const until = new Date(now.getTime() + days * DAY);
    const where: Prisma.SubscriptionWhereInput = {
      status: 'ACTIVE', endsAt: { gt: now, lte: until },
      user: { subscriptions: { none: { status: 'ACTIVE', endsAt: { gt: until } } } },
    };
    const dayStart = remindDayStart(now);
    const load = async (p: number, take: number): Promise<Expiring[]> => {
      const rows = await this.prisma.subscription.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, phone: true } }, plan: { select: { code: true, name: true } } },
        orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
        skip: (p - 1) * take, take,
      });
      const ids = rows.map((r) => r.id);
      const manual = ids.length
        ? await this.prisma.auditLog.findMany({ where: { action: REMIND_ACTION, entityId: { in: ids } }, select: { entityId: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 500 })
        : [];
      const lastBy = new Map<string, Date>();
      for (const m of manual) if (m.entityId && !lastBy.has(m.entityId)) lastBy.set(m.entityId, m.createdAt);
      return rows.map((r) => {
        const lastManualAt = lastBy.get(r.id) ?? null;
        return {
          id: r.id, no: r.no, months: r.months, amountTiyin: Number(r.amountTiyin), endsAt: r.endsAt!, remindedAt: r.remindedAt, lastManualAt,
          remindedToday: !!remindBlockedAt(lastManualAt, r.remindedAt, dayStart),
          user: r.user, plan: r.plan ? { code: r.plan.code, name: r.plan.name as Record<string, string> } : null,
        };
      });
    };
    const agg = await this.prisma.subscription.aggregate({ where, _count: true, _sum: { amountTiyin: true } });
    const total = agg._count;
    const summary = { count: total, amountTiyin: Number(agg._sum.amountTiyin ?? 0) };
    if (format === 'csv') {
      return sendCsv({ reply: reply!, audit: this.audit, actorId: userId, resource: 'revenue-expiring', filters: { days }, total, rows: () => load(1, CSV_MAX), cols: EXPIRING_CSV });
    }
    const p = clampInt(page, 1, 1, 100_000);
    const take = clampInt(limit, 30, 1, 100);
    return { items: await load(p, take), total, page: p, limit: take, days, summary };
  }

  /**
   * PAY solishtiruvi: har tasdiqda operator yozgan kutilgan va kelgan summa (audit meta) yonma-yon.
   *
   * Nega raw SQL: farq va yig'indi JSON ichidagi sonlardan; Prisma JSON ustunini solishtira
   * olmaydi. Jadval nomi va ustunlar kodda qat'iy, parametr faqat qiymat (day-counts.ts uslubi).
   * Regex himoyasi: eski qatorlarda summa yo'q yoki matn bo'lishi mumkin, u NULL bo'lib
   * "kiritilmagan" chelagiga tushadi, cast yiqilmaydi. LEFT JOIN: obuna o'chgan bo'lsa ham
   * tasdiq ko'rinadi (no null).
   */
  @Get('reconcile')
  async reconcile(
    @CurrentUserId() userId: string,
    @Query('q') q?: string,
    @Query('diff') diff?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) reply?: FastifyReply,
  ) {
    const now = new Date();
    const from = uzLocalToUtc(`${monthBack(monthKey(now), 12)}-01`, '00:00');
    const conds: Prisma.Sql[] = [];
    const text = (q ?? '').trim().slice(0, 80);
    if (text) {
      // LIKE belgilari qochiriladi: '%' yoki '_' yozilsa qidiruv butun ro'yxatni qaytarmasin
      const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conds.push(Prisma.sql`(payref ILIKE ${like} OR no ILIKE ${like})`);
    }
    if (diff === '1') conds.push(Prisma.sql`received IS NOT NULL AND received <> expected`);
    else if (diff === 'none') conds.push(Prisma.sql`received IS NULL`);
    const whereSql = conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty;
    const base = Prisma.sql`WITH r AS (
      SELECT a.id, a."createdAt" AS "at", a."entityId" AS "subscriptionId", a."actorId", s.no, s."userId",
        CASE WHEN a.meta->>'expectedTiyin' ~ '^[0-9]+$' THEN (a.meta->>'expectedTiyin')::bigint END AS expected,
        CASE WHEN a.meta->>'receivedTiyin' ~ '^[0-9]+$' THEN (a.meta->>'receivedTiyin')::bigint END AS received,
        a.meta->>'payRef' AS payref
      FROM "AuditLog" a LEFT JOIN "Subscription" s ON s.id = a."entityId"
      WHERE a.action = 'subscription.confirm' AND a."createdAt" >= ${from}
    )`;
    const load = async (p: number, take: number): Promise<Reconcile[]> => {
      const raw = await this.prisma.$queryRaw<ReconcileRaw[]>`${base} SELECT * FROM r ${whereSql} ORDER BY "at" DESC, id ASC LIMIT ${take} OFFSET ${(p - 1) * take}`;
      const people = await this.people([...raw.map((r) => r.userId), ...raw.map((r) => r.actorId)]);
      return raw.map((r) => ({
        id: r.id, at: r.at, subscriptionId: r.subscriptionId, no: r.no, user: (r.userId && people.get(r.userId)) || null,
        expectedTiyin: num(r.expected), receivedTiyin: num(r.received), payRef: r.payref, actor: (r.actorId && people.get(r.actorId)) || null,
      }));
    };
    const [s] = await this.prisma.$queryRaw<{ confirmed: bigint; expectedTiyin: bigint; receivedTiyin: bigint; noReceived: bigint; diffCount: bigint; shortTiyin: bigint; overTiyin: bigint }[]>`${base}
      SELECT count(*) confirmed,
        coalesce(sum(expected), 0)::bigint "expectedTiyin",
        coalesce(sum(received), 0)::bigint "receivedTiyin",
        count(*) FILTER (WHERE received IS NULL) "noReceived",
        count(*) FILTER (WHERE received IS NOT NULL AND received <> expected) "diffCount",
        coalesce(sum(expected - received) FILTER (WHERE received < expected), 0)::bigint "shortTiyin",
        coalesce(sum(received - expected) FILTER (WHERE received > expected), 0)::bigint "overTiyin"
      FROM r ${whereSql}`;
    const summary = {
      confirmed: Number(s.confirmed), expectedTiyin: Number(s.expectedTiyin), receivedTiyin: Number(s.receivedTiyin), noReceived: Number(s.noReceived),
      diffCount: Number(s.diffCount), shortTiyin: Number(s.shortTiyin), overTiyin: Number(s.overTiyin),
    };
    const total = summary.confirmed;
    if (format === 'csv') {
      return sendCsv({ reply: reply!, audit: this.audit, actorId: userId, resource: 'revenue-reconcile', filters: { q: text, diff }, total, rows: () => load(1, CSV_MAX), cols: RECONCILE_CSV });
    }
    const p = clampInt(page, 1, 1, 100_000);
    const take = clampInt(limit, 30, 1, 100);
    return { items: await load(p, take), total, page: p, limit: take, summary };
  }

  /**
   * Bekorlar: tasdiq bekori (revoke, pul kelgan-kelmagani bilan) va to'lanmagan buyurtma bekori
   * (cancel). Manba auditning o'zi: ikkala amal allaqachon sabab va summa bilan yoziladi.
   */
  @Get('refunds')
  async refunds(
    @CurrentUserId() userId: string,
    @Query('kind') kind?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) reply?: FastifyReply,
  ) {
    const k = pickIn(kind, REFUND_KINDS);
    const actions = k ? [`subscription.${k}`] : ['subscription.revoke', 'subscription.cancel'];
    const where: Prisma.AuditLogWhereInput = { action: { in: actions } };
    const meta = (m: unknown) => (m ?? {}) as Record<string, unknown>;
    const load = async (p: number, take: number): Promise<Refund[]> => {
      const rows = await this.prisma.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (p - 1) * take, take });
      const subs = await this.subsOf(rows.map((r) => r.entityId));
      const people = await this.people([...rows.map((r) => r.actorId), ...rows.map((r) => meta(r.meta).userId as string | undefined), ...[...subs.values()].map((s) => s.userId)]);
      return rows.map((r) => {
        const m = meta(r.meta);
        const sub = r.entityId ? subs.get(r.entityId) : undefined;
        const revoke = r.action === 'subscription.revoke';
        const uid = typeof m.userId === 'string' ? m.userId : sub?.userId;
        return {
          id: r.id, at: r.createdAt, action: r.action as Refund['action'], subscriptionId: r.entityId ?? '', no: sub?.no ?? null,
          amountTiyin: typeof m.amountTiyin === 'number' ? m.amountTiyin : sub ? Number(sub.amountTiyin) : null,
          moneyReceived: revoke ? m.moneyReceived === true : null,
          reason: typeof m.reason === 'string' ? m.reason : null,
          wasEndsAt: typeof m.wasEndsAt === 'string' ? m.wasEndsAt : null,
          user: (uid && people.get(uid)) || null, actor: (r.actorId && people.get(r.actorId)) || null,
        };
      });
    };
    const [groups, revokes] = await Promise.all([
      this.prisma.auditLog.groupBy({ by: ['action'], where, _count: true }),
      // Pul kelgan bekorlar xotirada: bayroq JSON ichida, Prisma count uni ko'rmaydi. Yiliga o'nlab qator.
      k === 'cancel' ? Promise.resolve([]) : this.prisma.auditLog.findMany({ where: { action: 'subscription.revoke' }, select: { entityId: true, meta: true }, take: 5000 }),
    ]);
    const countOf = (a: string) => (groups.find((g) => g.action === a)?._count as unknown as number) ?? 0;
    const paid = revokes.filter((r) => meta(r.meta).moneyReceived === true);
    // Eski revoke qatorida summa yo'q bo'lishi mumkin: obuna qatoridan olinadi
    const subsForPaid = await this.subsOf(paid.filter((r) => typeof meta(r.meta).amountTiyin !== 'number').map((r) => r.entityId));
    let revokesPaidTiyin = 0;
    for (const r of paid) {
      const a = meta(r.meta).amountTiyin;
      revokesPaidTiyin += typeof a === 'number' ? a : Number(subsForPaid.get(r.entityId ?? '')?.amountTiyin ?? 0);
    }
    const summary = { revokes: countOf('subscription.revoke'), revokesPaid: paid.length, revokesPaidTiyin, cancels: countOf('subscription.cancel') };
    const total = summary.revokes + summary.cancels;
    if (format === 'csv') {
      return sendCsv({ reply: reply!, audit: this.audit, actorId: userId, resource: 'revenue-refunds', filters: { kind: k }, total, rows: () => load(1, CSV_MAX), cols: REFUNDS_CSV });
    }
    const p = clampInt(page, 1, 1, 100_000);
    const take = clampInt(limit, 30, 1, 100);
    return { items: await load(p, take), total, page: p, limit: take, summary };
  }

  /** AuditLog da User ga relation yo'q (o'chirilgan hisob izini uzmaslik uchun): ismlar alohida so'rov bilan. */
  private async people(ids: (string | null | undefined)[]): Promise<Map<string, Person>> {
    const uniq = [...new Set(ids.filter((x): x is string => !!x))];
    if (!uniq.length) return new Map();
    const rows = await this.prisma.user.findMany({ where: { id: { in: uniq } }, select: { id: true, fullName: true, phone: true } });
    return new Map(rows.map((u) => [u.id, u]));
  }

  private async subsOf(ids: (string | null | undefined)[]) {
    const uniq = [...new Set(ids.filter((x): x is string => !!x))];
    const rows = uniq.length
      ? await this.prisma.subscription.findMany({ where: { id: { in: uniq } }, select: { id: true, no: true, amountTiyin: true, userId: true } })
      : [];
    return new Map(rows.map((s) => [s.id, s]));
  }
}
