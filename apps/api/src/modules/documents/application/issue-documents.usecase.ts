import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { INVOICE, SERVICE_LABELS, TARIFF_UNIT_LABELS, formatActNo, formatInvoiceNo, formatSom } from '@yuksaroy/domain';
import { PrismaService } from '../../../common/prisma.service';
import { env } from '../../../common/env';
import type { DocLine, DocPayload, Party } from '../domain/ports';
import type { OrderRecord } from '../../orders/domain/ports';

/**
 * Buyurtma yakunlanganda ikki hujjat tuziladi: bajarilgan ishlar dalolatnomasi va to'lov uchun hisob (3.2, 7-8 qadam).
 * Ikkalasi bitta tranzaksiyada, idempotent: bir buyurtmaga bir marta.
 */
@Injectable()
export class IssueDocumentsUseCase {
  private readonly log = new Logger('Documents');

  constructor(private readonly prisma: PrismaService) {}

  async onOrderCompleted(order: OrderRecord): Promise<void> {
    try {
      await this.issue(order);
    } catch (e) {
      // Hujjat tuzilmasa ham buyurtma yakunlangan bo'lib qolaveradi: qayta urinish uchun log
      this.log.error(`hujjat tuzilmadi, buyurtma ${order.no}: ${(e as Error).message}`);
    }
  }

  async issue(order: OrderRecord): Promise<void> {
    const already = await this.prisma.document.count({ where: { orderId: order.id } });
    if (already > 0) return;

    const [terminal, payer] = await Promise.all([
      this.prisma.terminal.findUnique({ where: { id: order.terminalId }, select: { name: true, address: true, org: { select: { name: true, stir: true } } } }),
      this.prisma.organization.findUnique({ where: { id: order.shipperOrgId }, select: { name: true, stir: true } }),
    ]);

    const supplier: Party = {
      name: terminal?.org?.name ?? terminal?.name ?? order.terminalName,
      stir: terminal?.org?.stir ?? null,
      address: terminal?.address ?? order.stationName,
    };
    const payerParty: Party = { name: payer?.name ?? order.shipperOrgName, stir: payer?.stir ?? null, address: null };
    const lines = toLines(order);
    const now = new Date();
    const dueAt = new Date(now.getTime() + INVOICE.dueDays * 86_400_000);

    await this.prisma.$transaction(async (tx) => {
      const [{ nextval: actSeq }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('act_no_seq')`;
      const [{ nextval: invSeq }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('invoice_no_seq')`;
      const actNo = formatActNo(Number(actSeq));
      const invNo = formatInvoiceNo(Number(invSeq));

      const base = {
        orderNo: order.no,
        terminalName: order.terminalName,
        stationName: order.stationName,
        slot: order.slot ? slotLabel(order.slot.startsAt, order.slot.endsAt) : null,
        supplier,
        payer: payerParty,
        lines,
        totalTiyin: order.totalTiyin,
        vatNote: vatNote(order),
        issuedAt: now.toISOString(),
      };

      for (const [kind, no, extra] of [
        ['ACT', actNo, {}],
        ['INVOICE', invNo, { dueAt: dueAt.toISOString() }],
      ] as const) {
        const qrToken = randomBytes(16).toString('base64url');
        const payload: DocPayload = { ...base, ...extra, no, verifyUrl: `${env.WEB_ORIGIN}/verify/${qrToken}` };
        await tx.document.create({
          data: {
            no, kind, orgId: order.shipperOrgId, orderId: order.id,
            payload: payload as unknown as object,
            sha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
            qrToken,
          },
        });
      }

      await tx.invoice.create({
        data: {
          no: invNo,
          // ponytail: DRAFT bosqichi F1 da ishlatilmaydi, ish bajarilgan va hisob darhol beriladi
          status: 'ISSUED',
          orgId: order.shipperOrgId,
          supplierOrgId: null,
          orderId: order.id,
          amountTiyin: BigInt(order.totalTiyin),
          dueAt,
        },
      });
    });

    this.log.log(`hujjatlar tuzildi: buyurtma ${order.no}`);
  }
}

function toLines(order: OrderRecord): DocLine[] {
  return order.items.map((i) => ({
    name: SERVICE_LABELS[i.serviceCode] ?? i.serviceCode,
    qty: `${i.qty} ${TARIFF_UNIT_LABELS[i.unit] ?? i.unit}`,
    unitPrice: formatSom(i.unitPriceTiyin),
    amount: formatSom(i.amountTiyin),
  }));
}

/** QQS platformada hisoblanmaydi: soliq maqomi terminalning o'zida, ESF F2 da (Didox). */
function vatNote(order: OrderRecord): string {
  const commission =
    order.commissionPayer === 'CLIENT' && order.commissionTiyin > 0
      ? ` Platforma komissiyasi ${order.commissionPct / 100} % summaga kiritilgan.`
      : ` Platforma komissiyasi ${order.commissionPct / 100} %.`;
  return `Summada QQS alohida ajratilmagan. Soliq hujjatini xizmat ko'rsatuvchi o'z buxgalteriyasi orqali rasmiylashtiradi.${commission}`;
}

const slotLabel = (a: Date, b: Date) => {
  const f = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', ...o }).format(d);
  return `${f(a, { day: '2-digit', month: '2-digit', year: 'numeric' })} ${f(a, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}-${f(b, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`;
};
