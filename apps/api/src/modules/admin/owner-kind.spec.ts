import { describe, expect, it } from 'vitest';
import { OWNER_KINDS, ownerKind } from '@yuksaroy/domain';
import { ownerKindWhere } from './owner-kind.where';

/*
 * Bu testdagi holatlar o'ylab topilmagan: hammasi reestrning o'zidan olingan va har
 * biri qoidaning birinchi variantida XATO tasniflangan qator. Shuning uchun ular shu
 * yerda turadi: qoida keyin o'zgartirilsa, aynan shu xatolar qaytib kelmasin.
 */
describe('ownerKind', () => {
  it('harbiy qismni har qanday yozilishida topadi', () => {
    for (const n of ['26134-ҳарбий қисм', '29262-сонли харбий кисм', 'Воинский часть 71181', 'в/часть-18299', 'Харбий қисм 08579']) {
      expect(ownerKind(n)).toBe('harbiy');
    }
  });

  it('mudofaa va maxsus obyektlar ham harbiy', () => {
    expect(ownerKind('Каршинская территориальная КЭЧ')).toBe('harbiy');
    expect(ownerKind('УР Мудофа Вазирлиги Марказий модди-техник таьминот базаси')).toBe('harbiy');
    expect(ownerKind('Фарғона худудий уй жойдан фойдаланиш қисми')).toBe('harbiy');
  });

  it("temir yo'lning o'z bo'linmasini topadi", () => {
    for (const n of ['ПЧ-12', 'ПМС-166', 'ВЧД Термез', 'Қўқон локомогтив депоси', 'ЭЧК-19 Қўқон электр таъминоти масофаси']) {
      expect(ownerKind(n)).toBe('temiryul');
    }
  });

  it("temir yo'lda ishlaydigan XUSUSIY pudratchi bo'linma emas", () => {
    // Birinchi variantda bular temiryul deb tasniflangan va o'chirishga tushib qolgan edi
    expect(ownerKind("`AZIZBEK TEMIR YO'L TA'MIR QURILISH` МЧЖ")).toBe('xususiy');
    expect(ownerKind("`TEMIR YO'L QURILISH SERVIS` МЧЖ 2-chi hudud")).toBe('xususiy');
    expect(ownerKind('`Технический сервис грузавих вагонов` МЧЖ')).toBe('xususiy');
  });

  it('davlat korxonasi va muassasasini topadi', () => {
    expect(ownerKind('УП Трубодеталь')).toBe('davlat');
    expect(ownerKind('Чимбайский РДЭУП')).toBe('davlat');
    expect(ownerKind('`MADAD` Давлат муассасаси')).toBe('davlat');
  });

  /*
   * Quyidagi qatorlar prodda FAOL holda topilgan: egasi ularni ko'rib "bunday narsa
   * qolmasligi kerak" dedi. Har biri shu yerda turadi, chunki ikkitasi birinchi
   * variantda o'tib ketgan edi.
   */
  it("jazoni ijro etish muassasasi harbiy toifada, huquqiy shakldan qat'i nazar", () => {
    expect(ownerKind('"35-сон манзил колонияси" ИЧК')).toBe('harbiy');
    expect(ownerKind('"Кумкурганвторчермет" ИЧК')).toBe('harbiy');
    // Xususiy shakl ham saqlab qola olmaydi: davlat toifasida bunday qator qolib ketardi
    expect(ownerKind('"Кумкурган" МЧЖ ИЧК')).toBe('harbiy');
  });

  it('lotin yozuvidagi koloniya NOMDAN topiladi', () => {
    // Prodda: nomi lotincha koloniya, egasi esa butunlay boshqa nom
    expect(ownerKind('11-sonli Jazoni Ijro Etish Koloniyasi', '"Навои Экспорт Бизнес" ДУК')).toBe('harbiy');
    // Egasi xususiy bo'lganda ham nom o'zi yetarli bo'lishi kerak
    expect(ownerKind('11-sonli Jazoni Ijro Etish Koloniyasi', '"Baraka" МЧЖ')).toBe('harbiy');
  });

  it('harbiy qismning hamma yozilishi topiladi', () => {
    for (const n of ['18299-сонли харбий кисм', 'В/часть-18299', 'Войсковая часть № 53949',
      'Воинской Части 63650', 'ЦБХТСГ МО РУ харбий кисм 26134', '№23716 ҳарбий қисм']) {
      expect(ownerKind(n)).toBe('harbiy');
    }
  });

  it("nom va ega nomidan qattiqrog'i olinadi", () => {
    // Nomi harbiy, egasi xususiy: harbiy ustun
    expect(ownerKind('Харбий қисм 53943', '"Baraka" МЧЖ')).toBe('harbiy');
    // Nomi oddiy, egasi temir yo'l bo'linmasi
    expect(ownerKind('Binokor yuk maydoni', 'ПЧ-12')).toBe('temiryul');
    // Ikkalasi ham xususiy
    expect(ownerKind('Andijon ombori', '"ANDIJON UN" МЧЖ')).toBe('xususiy');
    // Faqat bittasi berilgan bo'lsa ham ishlaydi
    expect(ownerKind(null, 'ПЧ-12')).toBe('temiryul');
  });

  it('gigantni AJ shaklida ham topadi', () => {
    expect(ownerKind('`НКМК` АЖ')).toBe('gigant');
    expect(ownerKind('АО Узметкомбинат')).toBe('gigant');
    expect(ownerKind('Ангренская ТЭС')).toBe('gigant');
    expect(ownerKind('`Агрокимёхимоя` АЖ Пахтачи филиал')).toBe('gigant');
  });

  it("shahar nomi gigant qilib qo'ymaydi", () => {
    // Navoiy shaharning nomi: bu qatorlar NGMK ga aloqasi yo'q xususiy korxonalar
    expect(ownerKind('`Навоий Хумо` МЧЖ')).toBe('xususiy');
    expect(ownerKind('`Навоий нефт базаси` МЧЖ')).toBe('xususiy');
    expect(ownerKind('ООО Навои гипс')).toBe('xususiy');
  });

  it("neft bazasi xususiy ham bo'ladi", () => {
    // Birinchi variantda hamma "neft bazasi" davlat ombori deb hisoblangan edi
    expect(ownerKind("`ANDIJON NEFT BAZASI` МЧЖ")).toBe('xususiy');
    expect(ownerKind('ООО `Термиз нефт базаси`')).toBe('xususiy');
    // Egasi ko'rinmaydigan ombor esa "bilinmadi": qo'lda ko'riladi
    expect(ownerKind('Ташкент ёқилғи омбори')).toBeNull();
  });

  it("nomning ichidagi tasodifiy bo'lak toifa bermaydi", () => {
    // "Гроуп'" ichidagi "УП'" tufayli bu qator davlat deb tasniflangan edi
    expect(ownerKind('`Интер Традинг Гроуп` МЧЖ ХК')).toBe('xususiy');
    // "Agrokimyo" xususiy nom, davlat AJ si esa "Agrokimyohimoya"
    expect(ownerKind("`Bo'ston Agrokimyo Trans-2` MCHJ")).toBe('xususiy');
  });

  it('xususiy shakllarning hammasini biladi', () => {
    for (const n of ['ЧП «Bek-Yus Trade»', 'ЧЛ «Xolmurodov F.A.»', 'СП Tarleplast (1)', 'ОК `Хонкелди`',
      '`SIYOB SHAVKAT ORZU-1` FX', '`Эгамқулов Бахриддин` ХК', 'Фуқаро Акбаров Икром Алиевич',
      '`Allaberganov Xusanboy Ulug`bekovich` ЯТТ', '`GULSANAM KELAJAGI` оилавий корхонаси']) {
      expect(ownerKind(n)).toBe('xususiy');
    }
  });

  it("belgisi yo'q nom va bo'sh qiymat null beradi", () => {
    expect(ownerKind('`Sharqiy Aeroport`')).toBeNull();
    expect(ownerKind('TURKISTON YULDUZI')).toBeNull();
    expect(ownerKind('')).toBeNull();
    expect(ownerKind(null)).toBeNull();
    expect(ownerKind(undefined)).toBeNull();
  });
});

describe('ownerKindWhere', () => {
  type Cond = { OR: [{ name: { contains: string; mode: string } }, { ownerNameRaw: { contains: string; mode: string } }] };

  it('har toifa ikkala ustunni ham qidiradi va harflarga sezgir emas', () => {
    for (const k of OWNER_KINDS) {
      const w = ownerKindWhere(k);
      expect(Array.isArray(w.OR)).toBe(true);
      expect((w.OR as unknown[]).length).toBeGreaterThan(0);
      // Har bo'lak nomda ham, ega nomida ham qidiriladi: bittasi tushib qolsa
      // prodda ko'rilgan koloniya kabi qator yana o'tib ketardi
      const first = (w.OR as Cond[])[0]!;
      expect(first.OR).toHaveLength(2);
      expect(first.OR[0].name.mode).toBe('insensitive');
      expect(first.OR[1].ownerNameRaw.mode).toBe('insensitive');
      expect(first.OR[0].name.contains).toBe(first.OR[1].ownerNameRaw.contains);
    }
  });

  it("harbiy va gigantda taqiqlangan bo'laklar yo'q, qolganlarida bor", () => {
    // Harbiy va gigant huquqiy shakldan ustun turadi: ular NOT ishlatmaydi
    expect(ownerKindWhere('harbiy').NOT).toBeUndefined();
    expect(ownerKindWhere('gigant').NOT).toBeUndefined();
    for (const k of ['temiryul', 'davlat', 'xususiy'] as const) {
      expect(Array.isArray(ownerKindWhere(k).NOT)).toBe(true);
    }
  });
});
