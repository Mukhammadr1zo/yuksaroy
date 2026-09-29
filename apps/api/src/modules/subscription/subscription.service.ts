import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Plan } from '@prisma/client';
import { SUBSCRIPTION_FALLBACK, SUBSCRIPTION_GRANTS, type PlanLimitKey, type SubscriptionGrant } from '@yuksaroy/domain';
import { PrismaService } from '../../common/prisma.service';
import { PlatformConfigService } from '../../common/platform-config.service';
import { REVEAL_ACTIONS } from '../../common/reveal-actions';
import { notifyBoth } from '../../common/telegram';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminNotify } from '../organizations/application/admin-notify';
import { extendPremium } from '../premium/extend-premium';
import { env } from '../../common/env';

export const SUBSCRIPTION_STATUSES = ['PENDING', 'ACTIVE', 'CANCELLED'] as const;

/** Rekvizit hali kiritilmagan bo'lsa odam murojaat formasiga yuboriladi. */
const PAY_PLACEHOLDER = "To'lov rekvizitlari hali kiritilmagan. Buyurtma raqamini ko'rsatib /contact orqali yozing, to'lov tasdiqlangach xizmat yoqiladi.";

/**
 * Qo'lda to'lov ko'rsatmasi. Rekvizit endi admin sozlamasida: uni o'zgartirish uchun
 * VPS ga kirib .env ni tahrirlash va idishni qayta ishga tushirish shart emas.
 * ponytail: env tarmog'i faqat eski prod qiymati uchun; sozlama to'ldirilgach olinadi.
 */
const payInstructions = (details: string) => ({
  method: 'manual' as const,
  details: details.trim() || env.PREMIUM_PAY_DETAILS?.trim() || PAY_PLACEHOLDER,
});

/**
 * Tarifning o'z soni bo'lsa o'sha, bo'lmasa berilgan zaxira.
 *
 * Son obunaning O'Z qatorida saqlanadi (tarifga havola emas): admin tarifni keyin
 * o'zgartirsa yoki o'chirsa, to'lab qo'ygan odamning sharti o'zgarmaydi.
 */
export const planLimit = (limits: unknown, key: PlanLimitKey, fallback: number) => {
  const n = (limits as Record<string, unknown> | null | undefined)?.[key];
  return typeof n === 'number' && n > 0 ? n : fallback;
};

/**
 * Katalog elementi: /subscription/plans, /subscription/price va /subscription/me
 * hammasi AYNAN shu shaklni beradi, ya'ni veb bitta turga qaraydi. id yo'q: buyurtma
 * kod bilan beriladi, id esa ichki havola.
 */
export const catalogView = (p: Plan) => ({
  code: p.code, name: p.name, features: p.features, priceMonthSom: p.priceMonthSom, grants: p.grants, maxMonths: p.maxMonths, limits: p.limits,
});

/**
 * Sukut tarif: tur berilmagan buyurtma va narxlar sahifasidagi "obuna" narxi shu.
 *
 * Ikkala ruxsatni ham beradigan tarif afzal: sukut faqat telefon bo'lsa, obuna sotib
 * olgan yangi odamga vagon qidiruvi ochilmay qolardi. Ular ichida tartib, keyin narx:
 * admin tartib bilan qaysi biri asosiy ekanini aytadi, teng bo'lsa arzoni. To'liq
 * tarif yo'q bo'lsa tartib bo'yicha birinchi faol tarif (ro'yxat allaqachon shunday).
 */
export function pickDefault(rows: readonly Plan[]): Plan | null {
  const full = rows.filter((p) => SUBSCRIPTION_GRANTS.every((g) => p.grants.includes(g)));
  return full.sort((a, b) => a.sort - b.sort || a.priceMonthSom - b.priceMonthSom)[0] ?? rows[0] ?? null;
}

/**
 * Ruxsatni beradigan ENG ARZON faol tarif. `exact` bo'lsa ruxsati aynan shu bitta
 * bo'lgani: "faqat vagon" deb so'ragan odamga faqat vagon tarifi sotiladi, to'liq
 * obuna emas, u arzonroq bo'lsa ham.
 */
export function cheapestIn(rows: readonly Plan[], grant: SubscriptionGrant, exact = false): Plan | null {
  const fits = rows.filter((p) => (exact ? p.grants.length === 1 && p.grants[0] === grant : p.grants.includes(grant)));
  return fits.sort((a, b) => a.priceMonthSom - b.priceMonthSom || a.sort - b.sort)[0] ?? null;
}

type Row = { id: string; no: string; userId: string; months: number; grants: string[]; amountTiyin: bigint; status: string; provider: string | null; startsAt: Date | null; endsAt: Date | null; paidAt: Date | null; createdAt: Date };
/** BigInt -> Number (JSON). */
export const subscriptionView = (s: Row) => ({ ...s, amountTiyin: Number(s.amountTiyin) });

/** Reyestr qatori: obuna + egasi. CSV ustunlari ham shu shakldan o'qiydi. */
export type RegistryRow = ReturnType<typeof subscriptionView> & { user: { id: string; fullName: string | null; phone: string | null } };

/**
 * Reyestr filtri: holat, matn (PAY raqami, telefon, ism), bitta odam (foydalanuvchi
 * sahifasining Pul yorlig'i), tanlangan qatorlar (ids), jadval sarlavhasidan tartib.
 */
export type RegistryFilter = { status?: string; q?: string; userId?: string; ids?: string[]; orderBy?: Prisma.SubscriptionOrderByWithRelationInput[] };
const registryWhere = (f: RegistryFilter): Prisma.SubscriptionWhereInput => {
  const text = f.q?.trim();
  return {
    ...(f.status ? { status: f.status } : {}),
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.ids ? { id: { in: f.ids } } : {}),
    ...(text
      ? {
          OR: [
            { no: { contains: text, mode: 'insensitive' as const } },
            { user: { phone: { contains: text } } },
            { user: { fullName: { contains: text, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };
};

/**
 * Bir tashkilotning buyurtmalarini navbatda yonma-yon qo'yadi.
 *
 * Jamoa bitta o'tkazma qiladi, operator esa uni ko'chirmaning bitta qatoriga
 * solishtiradi: qatorlar sana bo'yicha aralashib yotsa u har bir xodimni
 * alohida qidirishga majbur bo'ladi va summani jamlay olmaydi.
 *
 * Guruhning o'rni uning eng eski qatoriga teng, ya'ni "eski birinchi" tartibi
 * saqlanadi: eng uzoq kutgan buyurtma baribir tepada turadi.
 *
 * Kalit id bo'yicha, nom bo'yicha emas: tashkilot nomi unikal emas, ya'ni bir xil
 * nomli ikki BOSHQA tashkilot bitta guruhga tushib ketardi va operator bitta
 * o'tkazmani begona qatorlarga taqsimlardi.
 *
 * Tashkilotsiz qator hech kim bilan guruhlanmaydi (kalit sifatida indeks olinadi):
 * ikki notanish odam bitta o'tkazma qilgandek ko'rinmasin.
 */
export function groupByOrg<T extends { orgId: string | null }>(rows: T[]): T[] {
  const groups = new Map<string | number, T[]>();
  rows.forEach((r, i) => {
    // Son va satr kaliti Map da hech qachon to'qnashmaydi
    const key = r.orgId ?? i;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  });
  return [...groups.values()].flat();
}

/** Obunachining e'lonlari: o'zinikilari va a'zo bo'lgan tashkilotlarniki. */
export async function subscriberListingFilter(tx: Pick<PrismaService, 'membership'>, userId: string) {
  const orgIds = (await tx.membership.findMany({ where: { userId }, select: { orgId: true } })).map((m) => m.orgId);
  return { OR: [{ ownerUserId: userId }, { createdById: userId }, ...(orgIds.length ? [{ orgId: { in: orgIds } }] : [])] };
}

/**
 * Obuna muddatigacha e'lonlarni ko'taradi. Faqat uzaytiradi: qo'lda berilgan uzoqroq
 * muddat (eski Premium to'lovi) qisqarib ketmasin.
 */
async function raiseListings(tx: Pick<PrismaService, 'membership' | 'listing'>, userId: string, endsAt: Date) {
  const owner = await subscriberListingFilter(tx, userId);
  await tx.listing.updateMany({
    where: { AND: [owner, { OR: [{ premiumUntil: null }, { premiumUntil: { lt: endsAt } }] }] },
    data: { premiumUntil: endsAt },
  });
}

/**
 * Foydalanuvchi obunasi: platformadagi yagona pullik mahsulot. U bilan telefon raqami
 * ochiladi, vagon qidiruvi cheksiz bo'ladi va odamning barcha e'lonlari ro'yxatda
 * yuqorida chiqadi. Ilgari e'lonni ko'tarish alohida sotilardi (Premium, har e'longa
 * alohida to'lov) va mijoz ikki marta to'lardi; endi bitta obuna hammasini qamraydi.
 *
 * To'lov yo'li Premium bilan bir xil: buyurtma PENDING, admin tasdiqlaydi, obuna
 * ACTIVE bo'ladi.
 *
 * Narx va kunlik raqam soni TARIFDA (Plan jadvali), sozlamada emas. Ilgari ikkisi
 * ham sozlamada, tarif esa alohida edi va ikkisi bir-biriga zid ketardi: admin
 * tarifni arzonlashtirsa devor baribir sozlamadagi narxni ko'rsatardi. Tarif
 * topilmaganda SUBSCRIPTION_FALLBACK ishlaydi, bu sozlama emas.
 */
@Injectable()
export class SubscriptionService {
  /** Tugagan obuna shuncha kungacha kartada ko'rsatiladi: undan eskisi qaror uchun ishlamaydi. */
  private static readonly LAPSED_DAYS = 90;

  /** Faol tariflar keshi, PlatformConfigService uslubida: admin kamdan-kam o'zgartiradi, o'qish har so'rovda. */
  private plans: { at: number; rows: Plan[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
    private readonly adminNotify: AdminNotify,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Faol obuna. `grant` berilsa faqat o'shani ochadigan qator qaraladi.
   *
   * Nega ro'yxat: telefon raqami va vagon qidiruvi alohida narxlanadi, lekin bitta
   * obuna ikkalasini ham ochishi mumkin. Eski qatorlarda migratsiya ikkalasini yozib
   * qo'ygan, shuning uchun bu yerda "eski qatormi" degan shart yo'q.
   */
  async active(userId: string, grant?: SubscriptionGrant, now = new Date()) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', endsAt: { gt: now }, ...(grant ? { grants: { has: grant } } : {}) },
      orderBy: { endsAt: 'desc' },
      // limits: tarifda o'z soni bo'lsa raqam chegarasi shu qatordan olinadi
      select: { id: true, endsAt: true, limits: true },
    });
  }

  /** Sotuvdagi tariflar: tartib, keyin kod bo'yicha. 60 s kesh; admin yozuvi invalidatePlans() bilan darhol kuchga kiradi. */
  async activePlans(): Promise<Plan[]> {
    if (this.plans && Date.now() - this.plans.at < 60_000) return this.plans.rows;
    const rows = await this.prisma.plan.findMany({ where: { active: true }, orderBy: [{ sort: 'asc' }, { code: 'asc' }], take: 20 });
    this.plans = { at: Date.now(), rows };
    return rows;
  }

  invalidatePlans() { this.plans = null; }

  async defaultPlan(): Promise<Plan | null> {
    return pickDefault(await this.activePlans());
  }

  /** Buyurtma uchun: avval ruxsati AYNAN shu bo'lgan tarif, bo'lmasa shu ruxsatni beradigan eng arzoni. */
  async planFor(grant: SubscriptionGrant): Promise<Plan | null> {
    const rows = await this.activePlans();
    return cheapestIn(rows, grant, true) ?? cheapestIn(rows, grant);
  }

  /** Devor ko'rsatadigan narx: ruxsatni beradigan eng arzon tarif, tarif yo'q bo'lsa zaxira son. */
  async priceFor(grant: SubscriptionGrant): Promise<number> {
    return cheapestIn(await this.activePlans(), grant)?.priceMonthSom ?? SUBSCRIPTION_FALLBACK.priceMonthSom;
  }

  /**
   * Kunlik raqam soni: obuna qatoridagi son, bo'lmasa sukut tarifniki, bo'lmasa zaxira.
   * Zanjir bitta joyda: devor, karta va narx sahifasi bir xil sonni ko'rsatsin.
   */
  async dailyLimitFor(limits: unknown): Promise<number> {
    const def = (await this.defaultPlan())?.limits;
    return planLimit(limits, 'phoneRevealDaily', planLimit(def, 'phoneRevealDaily', SUBSCRIPTION_FALLBACK.phoneRevealDaily));
  }

  /**
   * Bitta e'lonni obuna muddatigacha ko'taradi: obunachi yangi e'lon bersa, u keyingi
   * tasdiqni kutmasdan darhol yuqorida chiqadi. Obunasi yo'q bo'lsa hech narsa qilmaydi.
   */
  async raiseListing(userId: string, listingId: string): Promise<void> {
    const act = await this.active(userId);
    if (!act?.endsAt) return;
    await this.prisma.listing.updateMany({
      where: { id: listingId, OR: [{ premiumUntil: null }, { premiumUntil: { lt: act.endsAt } }] },
      data: { premiumUntil: act.endsAt },
    });
  }

  async isActive(userId: string, grant?: SubscriptionGrant): Promise<boolean> {
    return (await this.active(userId, grant)) !== null;
  }

  async me(userId: string) {
    const now = new Date();
    const [act, pending, cfg, catalog] = await Promise.all([
      this.active(userId, undefined, now),
      this.prisma.subscription.findFirst({ where: { userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } }),
      this.config.get(),
      this.activePlans(),
    ]);
    // Sukut tarif va ruxsat narxlari o'sha ro'yxatdan: qo'shimcha so'rov yo'q
    const def = pickDefault(catalog);
    // Har ruxsat turi alohida: faolmi, qachongacha, qancha turadi. Eski maydonlar
    // o'z joyida qoladi, chunki ularni oltita ekran va bot o'qiydi.
    const rows = await Promise.all(SUBSCRIPTION_GRANTS.map((grant) => this.active(userId, grant, now)));
    const plans = SUBSCRIPTION_GRANTS.map((grant, i) => ({
      grant, active: rows[i] !== null, endsAt: rows[i]?.endsAt ?? null, pricePerMonthSom: cheapestIn(catalog, grant)?.priceMonthSom ?? null,
    }));
    // Kunlik raqam chegarasi TELEFON obunasining qatoridan: vagon tarifi bilan kelgan
    // odamga telefon chegarasi ko'rsatilsa u yo'q huquqning sonini ko'rardi
    const phoneRow = rows[SUBSCRIPTION_GRANTS.indexOf('PHONE')];
    return {
      active: act !== null,
      endsAt: act?.endsAt ?? null,
      plans,
      // Faol obunachiga ortiqcha so'rov ketmaydi: tugagani faqat obunasizga qaraladi
      expired: act ? null : await this.lapsed(userId, now),
      pricePerMonthSom: def?.priceMonthSom ?? SUBSCRIPTION_FALLBACK.priceMonthSom,
      catalog: catalog.map(catalogView),
      // Kartadagi chegaralar shu yerdan: ikkinchi chaqiruv (narx yo'li) kartaga ikkinchi yuklanish qo'shardi.
      // Faol obuna tarifning o'z sonini olib kelgan bo'lsa kartada AYNAN o'sha ko'rinadi,
      // bo'lmasa sukut tarifniki: dailyLimitFor bilan bir xil zanjir, lekin so'rovsiz
      phoneRevealDaily: planLimit(phoneRow?.limits, 'phoneRevealDaily', planLimit(def?.limits, 'phoneRevealDaily', SUBSCRIPTION_FALLBACK.phoneRevealDaily)),
      wagonSearchFree: cfg.wagonSearchFree,
      pending: pending ? { ...subscriptionView(pending), payInstructions: payInstructions(cfg.payDetails) } : null,
    };
  }

  /**
   * Yaqinda tugagan obuna: qachon tugagani va shu muddatda necha marta raqam ochilgani.
   *
   * Raqam soni bezak emas: odam yangilash haqida qaror qilayotganda obuna unga nima
   * berganini ko'rsatadi va nol bo'lsa ekranga umuman chiqmaydi. Uch oydan eski obuna
   * ko'rsatilmaydi, chunki eski son bugungi qaror uchun hech narsa bermaydi.
   * Qator ACTIVE bo'lib qolaveradi: tugagani endsAt dan bilinadi, holat o'zgarmaydi.
   */
  private async lapsed(userId: string, now: Date) {
    const from = new Date(now.getTime() - SubscriptionService.LAPSED_DAYS * 86_400_000);
    const s = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', endsAt: { lte: now, gt: from } },
      orderBy: { endsAt: 'desc' },
      select: { startsAt: true, endsAt: true, createdAt: true },
    });
    if (!s?.endsAt) return null;
    const reveals = await this.prisma.auditLog.count({
      where: { actorId: userId, action: { in: [...REVEAL_ACTIONS] }, createdAt: { gte: s.startsAt ?? s.createdAt, lt: s.endsAt } },
    });
    return { endsAt: s.endsAt, reveals };
  }

  /**
   * Buyurtma berish. Ochiq (PENDING) buyurtma bo'lsa yangisi ochilmaydi, o'sha qaytadi:
   * tugmani ikki marta bosgan odam admin navbatida ikki qator bo'lib chiqmasin.
   */
  /**
   * Buyurtma HAR DOIM biror tarifdan: kod berilsa o'sha, ruxsat berilsa shu ruxsatni
   * beradigan eng arzoni, hech biri bo'lmasa sukut tarif (ikkala ruxsat ham).
   *
   * Nega sukut to'liq: ekranda hali bitta karta bor va u turni yubormaydi. Sukut
   * "PHONE" bo'lsa, obuna sotib olgan yangi odamga vagon qidiruvi ochilmay qolardi,
   * ya'ni bugungi mijoz uchun orqaga qadam bo'lardi. Alohida arzon tarif ataylab
   * tanlanganda sotiladi.
   *
   * Sotuvda tarif yo'q bo'lsa buyurtma ochilmaydi (NO_PLAN): narxsiz buyurtma admin
   * navbatida "0 so'm" bo'lib turardi. Admin tarifni o'chirishda LAST_PLAN qorovuli bor,
   * shuning uchun bu holat amalda faqat bo'sh bazada uchraydi.
   */
  async order(userId: string, months: number, grant?: SubscriptionGrant, planCode?: string) {
    const cfg = await this.config.get();
    /*
     * Narx, ruxsat va chegara SHU QATORDAN olinadi. Yo'q yoki sotuvdan olingan kod jim
     * o'tib ketmaydi: aks holda odam arzon tarifni tanlab, hisobida boshqa narxni
     * ko'rib qolardi. Kod keshdan qaraladi: admin yozuvi keshni tozalaydi.
     */
    const p = planCode
      ? (await this.activePlans()).find((x) => x.code === planCode) ?? null
      : grant ? await this.planFor(grant) : await this.defaultPlan();
    if (planCode && !p) throw new NotFoundException({ code: 'PLAN_NOT_FOUND' });
    if (!p) throw new ConflictException({ code: 'NO_PLAN' });
    if (months > p.maxMonths) throw new ConflictException({ code: 'PLAN_MAX_MONTHS', maxMonths: p.maxMonths });
    const { grants } = p;
    const som = p.priceMonthSom;
    // Ochiq buyurtma ham tur bo'yicha ajratiladi: telefon uchun ochiq buyurtmasi bor odam
    // vagon tarifini olmoqchi bo'lsa, unga eski buyurtma va boshqa summa qaytarilardi.
    // Tarif ham shartda: bir xil ruxsatli ikki tarifning narxi boshqa bo'lishi mumkin
    const openWhere = { where: { userId, status: 'PENDING', grants: { hasEvery: grants }, planId: p.id }, orderBy: { createdAt: 'desc' as const } };
    try {
      // Serializable: ikki so'rov bir vaqtda kelsa (ikki marta bosish, ikki varaq) ikkinchisi
      // yiqiladi va pastda mavjud buyurtma qaytariladi; aks holda navbatda ikki qator bo'lardi
      return await this.prisma.$transaction(async (tx) => {
        const open = await tx.subscription.findFirst(openWhere);
        if (open) return { order: subscriptionView(open), payInstructions: payInstructions(cfg.payDetails), reused: true };
        // Ketma-ketlik tranzaksiyaga bo'ysunmaydi: qayta urinishda raqam tushib qoladi,
        // lekin hech qachon takrorlanmaydi. Buyurtmadagi yo'l bilan bir xil
        const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('pay_no_seq')`;
        const s = await tx.subscription.create({
          // limits qatorga KO'CHIRILADI: admin tarifni keyin o'zgartirsa ham shartlar o'zgarmaydi
          data: { no: `PAY-${Number(nextval)}`, userId, months, grants, amountTiyin: BigInt(months * som * 100), status: 'PENDING', provider: 'manual', planId: p.id, limits: p.limits == null ? undefined : (p.limits as Prisma.InputJsonValue) },
        });
        // Takror xabar kaliti odamga bog'langan, buyurtmaga emas: bekor qilib qayta buyurtma
        // bergan odam har safar yangi id bilan adminlarga xabar yog'dira olmasin
        void this.adminNotify.queued('subscriptionPending', `${s.no}, ${months} oy`, `sub:${userId}`, userId).catch(() => {});
        return { order: subscriptionView(s), payInstructions: payInstructions(cfg.payDetails), reused: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034')) throw e;
      const open = await this.prisma.subscription.findFirst(openWhere);
      if (!open) throw e;
      return { order: subscriptionView(open), payInstructions: payInstructions(cfg.payDetails), reused: true };
    }
  }

  /**
   * Admin navbati: berilgan holat, eski birinchi, bir tashkilotniki yonma-yon.
   *
   * Tashkilot a'zolikdan olinadi, buyurtmada saqlanmaydi: jamoa uchun alohida hisob
   * qurilmagan, bu ustun faqat operator bitta o'tkazmani bir necha qatorga
   * taqsimlayotganda kerak.
   *
   * Xodim bir necha tashkilotda a'zo bo'lsa a'zoliklardan biri tanlanadi (eng eskisi).
   * Bu uning ish beruvchisi ekanini kafolatlamaydi va kafolatlay ham olmaydi, shuning
   * uchun ustun qaror bermaydi: operator baribir to'lov izohidagi PAY raqamiga qaraydi.
   */
  async list(status: string) {
    const rows = await this.prisma.subscription.findMany({
      where: { status },
      include: {
        user: {
          select: {
            fullName: true,
            phone: true,
            email: true,
            memberships: { select: { orgId: true, org: { select: { name: true } } }, orderBy: { createdAt: 'asc' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return groupByOrg(rows.map(({ user: { memberships, ...user }, ...s }) => ({ ...subscriptionView(s), user, orgId: memberships[0]?.orgId ?? null, orgName: memberships[0]?.org.name ?? null })));
  }

  /**
   * To'lov tasdiqlandi. Faol obuna bo'lsa yangi muddat uning tugashidan boshlanadi,
   * bo'lmasa hozirdan: erta to'lagan odam kunlarini yo'qotmaydi.
   */
  async confirm(id: string, now = new Date()) {
    const out = await this.prisma.$transaction(async (tx) => {
      const s = await tx.subscription.findUnique({ where: { id } });
      if (!s) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND' });
      if (s.status !== 'PENDING') throw new ConflictException({ code: 'SUBSCRIPTION_NOT_PENDING', status: s.status });
      /*
       * Muddat faqat yangi obunaning HAMMA ruxsatini qoplaydigan faol qatordan davom etadi.
       *
       * Ilgari har qanday faol qator olinardi, keyin ruxsati BITTASI mos kelgani. Ikkisi
       * ham xato: kirish startsAt ga emas, endsAt ga qaraydi. 12 oylik vagon obunasi
       * ustidan 1 oylik to'liq tarifni olgan odam vagon qatoridan davom etsa, telefon
       * bugundan 12 oyga ochilardi. Endi bunday buyurtma hozirdan boshlanadi (vagon
       * qatori o'z muddatida qolaveradi, odam hech narsa yo'qotmaydi); to'liq obuna
       * ustidan vagon olinsa avvalgidek obuna tugashidan davom etadi.
       */
      const cur = await tx.subscription.findFirst({
        where: { userId: s.userId, status: 'ACTIVE', endsAt: { gt: now }, grants: { hasEvery: s.grants } },
        orderBy: { endsAt: 'desc' },
        select: { endsAt: true },
      });
      const endsAt = extendPremium(cur?.endsAt ?? null, s.months, now);
      const startsAt = cur?.endsAt ?? now;
      // Holat sharti yangilashning o'zida: ikki admin bir vaqtda bossa faqat bittasi o'tadi
      const r = await tx.subscription.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'ACTIVE', startsAt, endsAt, paidAt: now, provider: s.provider ?? 'manual' } });
      if (r.count === 0) throw new ConflictException({ code: 'SUBSCRIPTION_NOT_PENDING' });
      // E'lonni ko'tarish telefon obunasining imtiyozi: arzon vagon tarifi uni bepul bermasin
      if (s.grants.includes('PHONE')) await raiseListings(tx, s.userId, endsAt);
      return subscriptionView({ ...s, status: 'ACTIVE', startsAt, endsAt, paidAt: now, provider: s.provider ?? 'manual' });
    });
    // Tranzaksiyadan keyin: o'zgarish qaytarib olinsa yolg'on xabar ketmasin
    this.tell(out.userId, 'subscriptionActive', { until: out.endsAt?.toISOString().slice(0, 10) ?? '' });
    return out;
  }

  /**
   * Foydalanuvchi o'z kutilayotgan buyurtmasini yopadi: 1 oy tanlagan odam uni bekor
   * qilib, 12 oyga qayta bera olsin (ochiq buyurtma turganda order() muddatni o'zgartirmaydi).
   *
   * Shart UPDATE ning ichida, chunki ayni damda admin tasdiqlayotgan bo'lishi mumkin:
   * tasdiq birinchi o'tsa bu yerda nol qator yangilanadi va obuna faol qolaveradi,
   * aksincha bo'lsa confirm() dagi shart tushmaydi va uning butun tranzaksiyasi
   * (e'lonlarni ko'tarish ham) orqaga qaytadi.
   */
  async cancelOwn(userId: string, id: string) {
    const s = await this.prisma.subscription.findFirst({ where: { id, userId }, select: { status: true } });
    if (!s) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND' });
    const r = await this.prisma.subscription.updateMany({ where: { id, userId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    if (r.count === 0) throw new ConflictException({ code: 'SUBSCRIPTION_NOT_PENDING', status: s.status });
    return this.me(userId); // karta yangi holatni shu javobdan oladi, ikkinchi so'rov kerak emas
  }

  /**
   * Obunachilar reyestri: holat bo'yicha, PAY raqami, telefon yoki ism bo'yicha qidiruv.
   *
   * Navbat ro'yxatidan (list) alohida, chunki ikkisining vazifasi boshqa: navbat
   * tashkilot bo'yicha guruhlanadi va faqat to'lanmaganini eski birinchi ko'rsatadi,
   * reyestr esa "kim to'layapti, kimniki tugayapti, kim ketdi" degan savolga javob beradi.
   *
   * Filtr, tartib va sahifalash bazada: qatorlar soni o'sib boradi va xotiraga olib
   * filtrlash jami sonini ham, oxirgi sahifani ham buzardi. Tartibda id ham bor:
   * bir soniyada yaratilgan ikki qator sahifalar orasida takrorlanmasin.
   */
  async registry(f: RegistryFilter & { page: number; limit: number }) {
    const where = registryWhere(f);
    const [total, rows] = await Promise.all([
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, phone: true } } },
        orderBy: f.orderBy ?? [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (f.page - 1) * f.limit,
        take: f.limit,
      }),
    ]);
    return { items: rows.map(({ user, ...s }): RegistryRow => ({ ...subscriptionView(s), user })), total, page: f.page, limit: f.limit };
  }

  /** CSV eksporti qatorlarni o'qishdan OLDIN sonni tekshiradi: chegaradan oshgani bekor o'qilmasin. */
  async registryCount(f: RegistryFilter) {
    return this.prisma.subscription.count({ where: registryWhere(f) });
  }

  /**
   * Tasdiqlangan obunani bekor qilish. Kirish shu zahoti to'xtaydi.
   *
   * Nega kerak edi: cancel() faqat to'lanmagan qatorga tegadi, ya'ni operator noto'g'ri
   * PAY qatorini tasdiqlab yuborsa obuna 12 oygacha faol qolardi va uni qaytaradigan
   * yo'l umuman yo'q edi.
   *
   * moneyReceived majburiy, sukut qiymati yo'q: pul kelmagan bo'lsa paidAt tozalanadi va
   * daromad varag'i bu xatoni ko'rsatmaydi; pul kelgan bo'lsa qator daromadda qoladi.
   * Ikkisini taxmin qilib bo'lmaydi, shuning uchun operator aytadi.
   */
  async revoke(id: string, reason: string, moneyReceived: boolean) {
    const s = await this.prisma.subscription.findUnique({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND' });
    const now = new Date();
    // Holat WHERE ichida: ikki admin bir vaqtda bosса ham faqat bittasi o'tadi
    const r = await this.prisma.subscription.updateMany({
      where: { id, status: 'ACTIVE' },
      data: { status: 'CANCELLED', endsAt: now, ...(moneyReceived ? {} : { paidAt: null }) },
    });
    if (r.count === 0) throw new ConflictException({ code: 'SUBSCRIPTION_NOT_ACTIVE', status: s.status });
    this.tell(s.userId, 'subscriptionCancelled', { reason });
    return { ...subscriptionView(s), status: 'CANCELLED', endsAt: now, paidAt: moneyReceived ? s.paidAt : null, wasEndsAt: s.endsAt };
  }

  /** To'lov kelmadi yoki buyurtma noto'g'ri: navbatdan chiqadi, obuna berilmaydi. */
  async cancel(id: string, reason: string) {
    const s = await this.prisma.subscription.findUnique({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND' });
    const r = await this.prisma.subscription.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    if (r.count === 0) throw new ConflictException({ code: 'SUBSCRIPTION_NOT_PENDING', status: s.status });
    this.tell(s.userId, 'subscriptionCancelled', { reason });
    return subscriptionView({ ...s, status: 'CANCELLED' });
  }

  /** Obunachiga qaror xabari: kabinetdagi qo'ng'iroq va Telegram; to'lov oqimini to'xtatmaydi. */
  private tell(userId: string, kind: 'subscriptionActive' | 'subscriptionCancelled', vars: Record<string, string>) {
    void notifyBoth(this.prisma, this.notifications, {
      target: { userIds: [userId] },
      kind,
      inApp: 'subscription',
      href: '/dashboard/subscription',
      vars,
    }).catch(() => {});
  }
}
