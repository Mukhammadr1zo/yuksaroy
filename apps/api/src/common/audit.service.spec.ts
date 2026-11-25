// Audit -> faoliyat xabari ulanishi: yozuv bilan birga hodisa ketadi, lekin foydalanuvchi so'rovi hech qachon buzilmaydi.
import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service';

const make = (prisma: any) => {
  const activity = { record: vi.fn() };
  return { audit: new AuditService(prisma, activity as any), activity };
};
const okPrisma = () => ({ auditLog: { create: vi.fn(async () => ({})), createMany: vi.fn(async () => ({ count: 0 })) } });
const failPrisma = () => ({ auditLog: { create: vi.fn(async () => { throw new Error('db'); }), createMany: vi.fn(async () => { throw new Error('db'); }) } });

describe('AuditService.log -> ActivityService.record', () => {
  it("amal, aktor, obyekt, meta va ip uzatiladi", async () => {
    const { audit, activity } = make(okPrisma());
    await audit.log({ actorId: 'u1', action: 'listing.create', entity: 'Listing', entityId: 'l1', meta: { orgId: 'o1' }, ip: '1.2.3.4' });
    expect(activity.record).toHaveBeenCalledWith({ actorId: 'u1', action: 'listing.create', entity: 'Listing', entityId: 'l1', meta: { orgId: 'o1' }, ip: '1.2.3.4' });
  });
  it("yozuv yiqilsa (strict emas) amal baribir xabar qilinadi", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { audit, activity } = make(failPrisma());
    await expect(audit.log({ actorId: 'u1', action: 'order.create' })).resolves.toBeUndefined();
    expect(activity.record).toHaveBeenCalledTimes(1);
  });
  it("strict yiqilsa: xabar yo'q va xato yuqoriga chiqadi", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { audit, activity } = make(failPrisma());
    await expect(audit.log({ actorId: 'u1', action: 'contact.reveal' }, true)).rejects.toThrow('db');
    expect(activity.record).not.toHaveBeenCalled();
  });
  it("activity bo'lmasa (ixtiyoriy) ham ishlaydi", async () => {
    const audit = new AuditService(okPrisma() as any);
    await expect(audit.log({ action: 'x' })).resolves.toBeUndefined();
  });
});

describe('AuditService.logMany', () => {
  it("37 qator = bitta hodisa, count 37", async () => {
    const { audit, activity } = make(okPrisma());
    const rows = Array.from({ length: 37 }, (_, i) => ({ actorId: 'a1', action: 'admin.terminal.bulkHide', entity: 'Terminal', entityId: `t${i}`, meta: { n: i } }));
    await audit.logMany(rows);
    expect(activity.record).toHaveBeenCalledTimes(1);
    expect(activity.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.terminal.bulkHide', actorId: 'a1', entityId: 't0', count: 37 }));
  });
  it("turli amallar: har tur uchun bitta", async () => {
    const { audit, activity } = make(okPrisma());
    await audit.logMany([
      { actorId: 'a1', action: 'a.x', entity: 'T', entityId: '1' },
      { actorId: 'a1', action: 'a.y', entity: 'T', entityId: '2' },
      { actorId: 'a1', action: 'a.x', entity: 'T', entityId: '3' },
    ]);
    expect(activity.record).toHaveBeenCalledTimes(2);
    expect(activity.record.mock.calls.map((c) => c[0].count)).toEqual([2, 1]);
  });
  it("bo'sh ro'yxat: hech narsa", async () => {
    const { audit, activity } = make(okPrisma());
    await audit.logMany([]);
    expect(activity.record).not.toHaveBeenCalled();
  });
});
