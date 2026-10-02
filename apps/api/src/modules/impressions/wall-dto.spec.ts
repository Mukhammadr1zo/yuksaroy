// To'lov devorining sanog'i ommaviy yo'ldan yozilmaydi.
//
// Nega alohida test: 'wall' turi ImpressionsService da bor, ya'ni uni ommaviy DTO ga
// qo'shib qo'yish bir harakat. Qo'shilsa esa son JIM buziladi: /events/impressions
// kirishsiz va begona odam bir so'rovda 50 ta "devor" yuborib sanoqni shishirib
// qo'yardi. Hech qanday xato chiqmaydi, faqat narx qarori yolg'on songa qarab olinadi.
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ImpressionItemDto } from './impressions.controller';

const codes = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(ImpressionItemDto, body)).flatMap((e) => Object.keys(e.constraints ?? {}));

describe("ommaviy mayoq formasi", () => {
  it("'wall' QABUL QILINMAYDI", () => {
    expect(codes({ kind: 'wall', targetId: 'phone', surface: 'view' })).toContain('isIn');
  });

  it("katalog mayog'i o'tadi", () => {
    expect(codes({ kind: 'listing', targetId: 'l1', surface: 'detail' })).toEqual([]);
  });

  it("'contact' ham qabul qilinmaydi: u ham faqat serverda", () => {
    expect(codes({ kind: 'listing', targetId: 'l1', surface: 'contact' })).toContain('isIn');
  });
});
