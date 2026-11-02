// Tasdiqlangan da'vo boshqa holatga o'tganda tashkilot obyektga egalik qilmaydi (reja 6-qadam 6-band).
import { describe, expect, it } from 'vitest';
import { AdminCatalogController } from './admin-catalog.controller';

function make(current: string) {
  const updates: { data: Record<string, unknown> }[] = [];
  const audits: { action: string; meta: Record<string, unknown> }[] = [];
  const prisma = {
    terminal: {
      findUnique: async (a: { select: Record<string, boolean> }) => (a.select.claimStatus ? { claimStatus: current, claimOrgId: 'org1', name: 'SOLANUZ' } : a.select.claimOrgId ? { claimOrgId: 'org1' } : null),
      update: async (a: { data: Record<string, unknown> }) => { updates.push(a); return {}; },
    },
  };
  const c = new AdminCatalogController(prisma as never, { log: async (x: { action: string; meta: Record<string, unknown> }) => { audits.push(x); } } as never, {} as never);
  return { c, updates, audits };
}

describe("da'voni qaytarib olish", () => {
  it('APPROVED dan REJECTED ga: orgId va claimedAt tozalanadi', async () => {
    const { c, updates } = make('APPROVED');
    await c.updateTerminal('admin', 't1', { claimStatus: 'REJECTED' } as never);
    expect(updates[0]!.data).toMatchObject({ claimStatus: 'REJECTED', orgId: null, claimedAt: null });
  });
  it("qaytarib olish terminal.claim.decide izini yozadi (avto-tasdiq qayta ishlamasin), PENDING dan emas", async () => {
    const a = make('APPROVED');
    await a.c.updateTerminal('admin', 't1', { claimStatus: 'REJECTED' } as never);
    expect(a.audits.map((x) => x.action)).toContain('terminal.claim.decide');
    expect(a.audits.find((x) => x.action === 'terminal.claim.decide')!.meta).toMatchObject({ approve: false, orgId: 'org1' });
    const p = make('PENDING');
    await p.c.updateTerminal('admin', 't1', { claimStatus: 'REJECTED' } as never);
    expect(p.audits.map((x) => x.action)).not.toContain('terminal.claim.decide');
  });
  it('PENDING dan REJECTED ga: egalik maydonlariga tegilmaydi', async () => {
    const { c, updates } = make('PENDING');
    await c.updateTerminal('admin', 't1', { claimStatus: 'REJECTED' } as never);
    expect(updates[0]!.data).not.toHaveProperty('orgId');
    expect(updates[0]!.data).not.toHaveProperty('claimedAt');
  });
  it('APPROVED ni qayta qo\'yish yoki holatsiz tahrir: tozalanmaydi', async () => {
    const { c, updates } = make('APPROVED');
    await c.updateTerminal('admin', 't1', { claimStatus: 'APPROVED' } as never);
    await c.updateTerminal('admin', 't1', { name: 'Yangi' } as never);
    expect(updates[0]!.data).toMatchObject({ orgId: 'org1' });
    expect(updates[1]!.data).not.toHaveProperty('claimedAt');
  });
});
