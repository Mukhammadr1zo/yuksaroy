import { Controller, Get, NotFoundException, Param, Post, Query, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { DOC_KIND_LABELS, INVOICE_STATUS_LABELS, canInvoiceTransition, type DocKind } from '@yuksaroy/domain';
import { CurrentUserId, JwtGuard } from '../../identity/presentation/jwt.guard';
import { PrismaService } from '../../../common/prisma.service';
import { AuditService } from '../../../common/audit.service';
import { env } from '../../../common/env';
import { ListOrdersUseCase } from '../../orders/application/list-orders.usecase';
import { OrderAccess } from '../../orders/application/order-access';
import { PdfService } from '../infrastructure/pdf.service';
import type { DocPayload } from '../domain/ports';
import { clampInt } from '../../catalog/presentation/catalog.controller';
import { mergeDocuments } from '../domain/mine';
import { DOC_LINK_TTL_SEC, signDocLink, verifyDocLink } from '../domain/signed-link';

const card = (d: { id: string; no: string; kind: DocKind; status: string; createdAt: Date; qrToken: string }) => ({
  id: d.id, no: d.no, kind: d.kind, kindLabel: DOC_KIND_LABELS[d.kind], status: d.status,
  createdAt: d.createdAt, qrToken: d.qrToken,
});

/** Hujjatlar: akt va to'lov uchun hisob. PDF saqlanmaydi, muzlatilgan payload'dan chiziladi. */
@ApiTags('documents')
@Controller()
export class DocumentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly orders: ListOrdersUseCase,
    private readonly access: OrderAccess,
    private readonly audit: AuditService,
  ) {}

  @Get('orders/:no/documents') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async byOrder(@CurrentUserId() userId: string, @Param('no') no: string) {
    const order = await this.orders.getForUser(userId, no); // ruxsat shu yerda tekshiriladi
    const [docs, invoice] = await Promise.all([
      this.prisma.document.findMany({ where: { orderId: order.id }, orderBy: { kind: 'asc' } }),
      this.prisma.invoice.findUnique({ where: { orderId: order.id } }),
    ]);
    return {
      documents: docs.map((d) => card(d as never)),
      invoice: invoice
        ? {
            no: invoice.no, status: invoice.status, statusLabel: INVOICE_STATUS_LABELS[invoice.status],
            amountTiyin: Number(invoice.amountTiyin), dueAt: invoice.dueAt, paidAt: invoice.paidAt,
          }
        : null,
    };
  }

  /** Mening hujjatlarim: mijoz (to'lovchi) yoki terminal (bajaruvchi) ko'rinishi; akt va hisob bitta ro'yxatda, hisob holati Invoice'dan. */
  @Get('documents/mine') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async mine(@CurrentUserId() userId: string, @Query('scope') scope?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const s = scope === 'terminal' ? 'terminal' : 'client';
    const where = s === 'terminal'
      ? { order: { terminalId: { in: await this.access.terminalIds(userId) } } }
      : { orgId: { in: await this.access.shipperOrgIds(userId) } };
    // ponytail: oxirgi 500 hujjat xotirada sahifalanadi; SQL UNION va cursor 500+ hujjatda
    const docs = await this.prisma.document.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500, select: { id: true, no: true, kind: true, status: true, createdAt: true, payload: true } });
    const invoices = await this.prisma.invoice.findMany({ where: { no: { in: docs.filter((d) => d.kind === 'INVOICE').map((d) => d.no) } }, select: { no: true, status: true, amountTiyin: true } });
    const all = mergeDocuments(
      docs.map((d) => { const p = d.payload as unknown as DocPayload; return { id: d.id, no: d.no, kind: d.kind, status: d.status, orderNo: p.orderNo, supplierName: p.supplier.name, payerName: p.payer.name, totalTiyin: p.totalTiyin, createdAt: d.createdAt }; }),
      invoices.map((i) => ({ no: i.no, status: i.status, amountTiyin: Number(i.amountTiyin) })),
      s,
    );
    const p = clampInt(page, 1, 1, 1000), l = clampInt(limit, 20, 1, 100);
    return { items: all.slice((p - 1) * l, p * l), total: all.length, page: p, limit: l };
  }

  @Get('documents/:id/download') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async download(@CurrentUserId() userId: string, @Param('id') id: string, @Res() reply: FastifyReply) {
    return this.sendPdf(reply, await this.docForUser(userId, id));
  }

  /** Mini App uchun: hujjatni tashqi brauzerda ochish havolasi (10 daqiqa, imzolangan). Ruxsat shu yerda tekshiriladi. */
  @Get('documents/:id/download-link') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async downloadLink(@CurrentUserId() userId: string, @Param('id') id: string) {
    await this.docForUser(userId, id);
    const exp = Math.floor(Date.now() / 1000) + DOC_LINK_TTL_SEC;
    const base = (env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '');
    return {
      url: `${base}/v1/documents/${id}/file?exp=${exp}&sig=${signDocLink(id, exp, env.JWT_SECRET)}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  /** Imzolangan havola bo'yicha berish: guard yo'q, ruxsat havola berilganda tekshirilgan. */
  @Get('documents/:id/file')
  async file(@Param('id') id: string, @Query('exp') exp: string, @Query('sig') sig: string, @Res() reply: FastifyReply) {
    if (!verifyDocLink(id, exp, sig, env.JWT_SECRET)) throw new UnauthorizedException({ code: 'DOC_LINK_INVALID' });
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND' });
    return this.sendPdf(reply, doc);
  }

  /** Ochiq tekshiruv: hujjatdagi havola shu yerga olib keladi. PDF emas, faqat mazmun. */
  @Get('verify/:qrToken')
  async verify(@Param('qrToken') qrToken: string) {
    const doc = await this.prisma.document.findUnique({ where: { qrToken } });
    if (!doc) return { valid: false };
    const p = doc.payload as unknown as DocPayload;
    return {
      valid: doc.status === 'READY',
      no: doc.no,
      kind: doc.kind,
      kindLabel: DOC_KIND_LABELS[doc.kind],
      issuedAt: p.issuedAt,
      orderNo: p.orderNo,
      supplier: p.supplier.name,
      payer: p.payer.name,
      totalTiyin: p.totalTiyin,
      sha256: doc.sha256,
    };
  }

  /** Bank o'tkazmasi kelgani: terminal tomoni yoki admin belgilaydi (F1 da onlayn to'lov yo'q). */
  @Post('invoices/:no/mark-paid') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async markPaid(@CurrentUserId() userId: string, @Param('no') no: string) {
    const inv = await this.prisma.invoice.findUnique({ where: { no } });
    if (!inv || !inv.orderId) throw new NotFoundException({ code: 'INVOICE_NOT_FOUND' });
    const order = await this.prisma.order.findUnique({ where: { id: inv.orderId }, select: { terminalId: true, no: true } });
    const [terminalIds, isAdmin] = await Promise.all([this.access.terminalIds(userId), this.access.isAdmin(userId)]);
    if (!order || (!isAdmin && !terminalIds.includes(order.terminalId))) throw new NotFoundException({ code: 'INVOICE_NOT_FOUND' });
    if (!canInvoiceTransition(inv.status, 'PAID_OFFLINE')) {
      return { no: inv.no, status: inv.status, statusLabel: INVOICE_STATUS_LABELS[inv.status], changed: false };
    }
    const upd = await this.prisma.invoice.update({
      where: { id: inv.id },
      data: { status: 'PAID_OFFLINE', paidAt: new Date(), paidMarkedById: userId },
    });
    await this.audit.log({ actorId: userId, action: 'invoice.paid', entity: 'Invoice', entityId: inv.id, meta: { no: inv.no, orderNo: order.no } });
    return { no: upd.no, status: upd.status, statusLabel: INVOICE_STATUS_LABELS[upd.status], paidAt: upd.paidAt, changed: true };
  }

  /** Hujjat + ruxsat: to'lovchi tashkilot yoki buyurtma tarafi. Ruxsat yo'q = topilmadi. */
  private async docForUser(userId: string, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND' });
    const orgIds = await this.access.shipperOrgIds(userId);
    const allowed = orgIds.includes(doc.orgId) || (doc.orderId ? await this.isOrderParty(userId, doc.orderId) : false);
    if (!allowed) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND' });
    return doc;
  }

  private sendPdf(reply: FastifyReply, doc: { no: string; kind: DocKind; payload: unknown }) {
    return this.pdf.render(doc.kind, doc.payload as DocPayload).then((buf) =>
      reply
        .header('content-type', 'application/pdf')
        .header('content-disposition', `inline; filename="${doc.no}.pdf"`)
        .send(buf),
    );
  }

  private async isOrderParty(userId: string, orderId: string) {
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, select: { no: true } });
    if (!o) return false;
    try {
      await this.orders.getForUser(userId, o.no);
      return true;
    } catch {
      return false;
    }
  }
}
