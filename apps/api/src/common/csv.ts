import { BadRequestException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { AuditService } from './audit.service';

/**
 * Admin ro'yxatining CSV eksporti. Ustunlar serverda qat'iy: mijozdagi yashirin ustunlar
 * hisobga olinmaydi, fayl har safar bir xil shaklda chiqadi.
 *
 * UTF-8 BOM va CRLF Excel uchun: BOM siz kirill nomlar krakozyabra bo'lib ochiladi.
 * Qochish RFC 4180: vergul, qo'shtirnoq yoki yangi qator bo'lsa qator qo'shtirnoqqa olinadi,
 * ichidagi qo'shtirnoq ikkilanadi. Sana ISO, BigInt tiyin so'mga (bazadagi pul ustunlari
 * BigInt tiyin, odam esa so'mda o'qiydi).
 */
export const CSV_MAX = 5000;

/** Sarlavha -> qiymat oluvchi. Kalitlar tartibi ustunlar tartibi. */
export type CsvCols<T> = Record<string, (row: T) => unknown>;

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? String(Number(v) / 100) : String(v);
  // Formula qochishi: nom, sarlavha yoki ism = + - @ bilan boshlansa Excel katakni formula deb
  // bajaradi (CWE-1236), qo'shtirnoq buni to'xtatmaydi; foydalanuvchi kiritgan matn eganing
  // Excel ida ochiladi. Faqat matnga apostrof: manfiy son (number) tegilmaydi
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csv<T>(rows: readonly T[], cols: CsvCols<T>): string {
  const heads = Object.keys(cols);
  const lines = [heads.map(cell).join(','), ...rows.map((r) => heads.map((h) => cell(cols[h]!(r))).join(','))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

/**
 * `?format=csv` oqimi bitta joyda: chegara, qatorlar, sarlavhalar, audit.
 *
 * Avval son: chegaradan oshgan bo'lsa qatorlar umuman o'qilmaydi va mijoz filtrni
 * toraytiradi. Har eksport auditga: telefon va pochta ro'yxati kim tomonidan olingani
 * keyin so'ralishi mumkin. Javob matnning o'zi: handler `@Res({ passthrough: true })`
 * bilan ishlaydi, Nest uni shu sarlavhalar bilan yuboradi.
 *
 * Qaytish turi `never`: handler ning JSON turi o'zgarmasin (spec lar `r.items` ni
 * to'g'ridan-to'g'ri o'qiydi). Amalda CSV matni qaytadi va Nest uni yuboradi.
 */
export async function sendCsv<T>(
  o: { reply: FastifyReply; audit: AuditService; actorId: string; resource: string; filters: Record<string, unknown>; total: number; rows: () => Promise<T[]>; cols: CsvCols<T> },
): Promise<never> {
  if (o.total > CSV_MAX) throw new BadRequestException({ code: 'EXPORT_TOO_MANY', max: CSV_MAX, total: o.total });
  const rows = await o.rows();
  // Faqat berilgan filtrlar: bo'sh kalitlar jurnalni shovqinga to'ldirmasin
  const filters = Object.fromEntries(Object.entries(o.filters).filter(([, v]) => v !== undefined && v !== ''));
  await o.audit.log({ actorId: o.actorId, action: 'admin.export', meta: { resource: o.resource, filters, rows: rows.length } });
  o.reply
    .header('content-type', 'text/csv; charset=utf-8')
    .header('content-disposition', `attachment; filename="${o.resource}-${new Date().toISOString().slice(0, 10)}.csv"`);
  return csv(rows, o.cols) as never;
}
