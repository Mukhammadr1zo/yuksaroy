import { Injectable } from '@nestjs/common';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import PDFDocument from 'pdfkit';
import { DOC_KIND_LABELS, formatSom, type DocKind } from '@yuksaroy/domain';
import type { DocPayload } from '../domain/ports';

/**
 * Akt va hisob PDF'i. Fayl saqlanmaydi: har safar muzlatilgan `payload` dan chiziladi,
 * shuning uchun hujjat hech qachon ma'lumotdan ajralib qolmaydi.
 * Shrift: Manrope (OFL) @fontsource paketidan, woff. Kirill ham kerak, chunki stansiya
 * nomlari reestrda ruscha ham uchraydi.
 */
const NAVY = '#002352';
const INK = '#0B2340';
const MUTED = '#52677E';
const LINE = '#DCE4EC';

@Injectable()
export class PdfService {
  private readonly fonts = resolveFonts();

  render(kind: DocKind, p: DocPayload): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `${DOC_KIND_LABELS[kind]} ${p.no}` } });
    if (this.fonts) {
      doc.registerFont('r', this.fonts.regular);
      doc.registerFont('b', this.fonts.bold);
    }
    const R = this.fonts ? 'r' : 'Helvetica';
    const B = this.fonts ? 'b' : 'Helvetica-Bold';

    header(doc, B, R, kind, p);
    parties(doc, B, R, p);
    lines(doc, B, R, p);
    footer(doc, B, R, kind, p);

    doc.end();
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }
}

/** @fontsource/manrope woff fayllari; topilmasa Helvetica (kirillsiz) ga tushamiz. */
function resolveFonts(): { regular: string; bold: string } | null {
  try {
    const req = createRequire(__filename);
    const base = join(dirname(req.resolve('@fontsource/manrope/package.json')), 'files');
    const regular = join(base, 'manrope-cyrillic-400-normal.woff');
    const bold = join(base, 'manrope-cyrillic-700-normal.woff');
    return existsSync(regular) && existsSync(bold) ? { regular, bold } : null;
  } catch {
    return null;
  }
}

const uz = (d: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));

function header(doc: PDFKit.PDFDocument, B: string, R: string, kind: DocKind, p: DocPayload) {
  doc.font(B).fontSize(9).fillColor(MUTED).text('YUKSAROY', { characterSpacing: 1.6 });
  doc.font(B).fontSize(19).fillColor(NAVY).text(DOC_KIND_LABELS[kind], { paragraphGap: 2 });
  doc.font(R).fontSize(10).fillColor(MUTED).text(`${p.no} · ${uz(p.issuedAt)}`);
  doc.moveDown(0.6);
  rule(doc);
}

function parties(doc: PDFKit.PDFDocument, B: string, R: string, p: DocPayload) {
  doc.moveDown(0.8);
  const top = doc.y;
  const colW = (doc.page.width - 96) / 2 - 12;
  block(doc, B, R, 48, top, colW, 'Ijrochi', p.supplier);
  block(doc, B, R, 48 + colW + 24, top, colW, 'Buyurtmachi', p.payer);
  doc.y = top + 74;
  doc.x = 48;
  doc.font(R).fontSize(9.5).fillColor(MUTED).text(`Buyurtma ${p.orderNo} · ${p.terminalName}, ${p.stationName}`);
  if (p.slot) doc.font(R).fontSize(9.5).fillColor(MUTED).text(`Vaqt oynasi: ${p.slot}`);
  doc.moveDown(0.7);
}

function block(doc: PDFKit.PDFDocument, B: string, R: string, x: number, y: number, w: number, label: string, v: DocPayload['payer']) {
  doc.font(R).fontSize(8.5).fillColor(MUTED).text(label.toUpperCase(), x, y, { width: w, characterSpacing: 1.1 });
  doc.font(B).fontSize(11).fillColor(INK).text(v.name, x, y + 13, { width: w });
  const meta = [v.stir ? `STIR ${v.stir}` : null, v.address].filter(Boolean).join('\n');
  if (meta) doc.font(R).fontSize(9).fillColor(MUTED).text(meta, x, y + 29, { width: w });
}

function lines(doc: PDFKit.PDFDocument, B: string, R: string, p: DocPayload) {
  const x = 48;
  const w = doc.page.width - 96;
  const cols = [w * 0.06, w * 0.44, w * 0.14, w * 0.16, w * 0.2];
  const at = (i: number) => x + cols.slice(0, i).reduce((a, b) => a + b, 0);

  rule(doc);
  doc.moveDown(0.35);
  const head = doc.y;
  doc.font(R).fontSize(8.5).fillColor(MUTED);
  ['№', 'XIZMAT', 'MIQDOR', 'NARX', 'SUMMA'].forEach((h, i) =>
    doc.text(h, at(i), head, { width: cols[i]! - 8, align: i >= 2 ? 'right' : 'left', characterSpacing: 1 }),
  );
  doc.y = head + 15;
  rule(doc);

  p.lines.forEach((l, i) => {
    doc.moveDown(0.45);
    const y = doc.y;
    doc.font(R).fontSize(10).fillColor(INK);
    doc.text(String(i + 1), at(0), y, { width: cols[0]! - 8 });
    doc.text(l.name, at(1), y, { width: cols[1]! - 8 });
    doc.text(l.qty, at(2), y, { width: cols[2]! - 8, align: 'right' });
    doc.text(l.unitPrice, at(3), y, { width: cols[3]! - 8, align: 'right' });
    doc.font(B).text(l.amount, at(4), y, { width: cols[4]! - 8, align: 'right' });
    doc.y = y + 16;
    rule(doc, LINE);
  });

  doc.moveDown(0.8);
  const ty = doc.y;
  doc.font(B).fontSize(12).fillColor(NAVY).text('Jami', at(1), ty, { width: cols[1]! + cols[2]! + cols[3]! - 8, align: 'right' });
  doc.font(B).fontSize(12).fillColor(NAVY).text(formatSom(p.totalTiyin), at(4), ty, { width: cols[4]! - 8, align: 'right' });
  doc.y = ty + 18;
  doc.x = x;
  doc.font(R).fontSize(9).fillColor(MUTED).text(p.vatNote, x, doc.y, { width: w });
}

function footer(doc: PDFKit.PDFDocument, B: string, R: string, kind: DocKind, p: DocPayload) {
  doc.moveDown(1.4);
  if (kind === 'INVOICE') {
    doc.font(B).fontSize(10).fillColor(INK).text(`To'lov muddati: ${uz(p.dueAt ?? p.issuedAt)}`);
    doc.font(R).fontSize(9.5).fillColor(MUTED).text(
      "To'lov bank o'tkazmasi bilan amalga oshiriladi. To'lov topshirig'ida hisob raqamini ko'rsating.",
      { width: doc.page.width - 96 },
    );
  } else {
    doc.font(R).fontSize(9.5).fillColor(MUTED).text(
      'Xizmat to\'liq bajarildi, tomonlarning bir-biriga da\'vosi yo\'q. Dalolatnoma ikki nusxada tuziladi.',
      { width: doc.page.width - 96 },
    );
    doc.moveDown(1.6);
    const y = doc.y;
    const half = (doc.page.width - 96) / 2 - 12;
    ['Ijrochi', 'Buyurtmachi'].forEach((role, i) => {
      const x = 48 + i * (half + 24);
      doc.moveTo(x, y + 22).lineTo(x + half - 40, y + 22).strokeColor(LINE).lineWidth(0.7).stroke();
      doc.font(R).fontSize(9).fillColor(MUTED).text(`${role}, imzo va muhr`, x, y + 27, { width: half });
    });
    doc.y = y + 46;
  }

  doc.moveDown(1);
  rule(doc);
  doc.moveDown(0.4);
  doc.font(R).fontSize(8).fillColor(MUTED).text(
    `Hujjat YukSaroy platformasida tuzilgan. Haqiqiyligini tekshirish: ${p.verifyUrl}`,
    { width: doc.page.width - 96 },
  );
}

function rule(doc: PDFKit.PDFDocument, color = '#C9D4E0') {
  const y = doc.y;
  doc.moveTo(48, y).lineTo(doc.page.width - 48, y).strokeColor(color).lineWidth(0.7).stroke();
  doc.y = y + 1;
  doc.x = 48;
}
