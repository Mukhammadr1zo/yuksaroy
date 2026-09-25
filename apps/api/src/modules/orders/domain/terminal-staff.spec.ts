import { describe, expect, it } from 'vitest';
import { terminalSideOrgIds } from './terminal-staff';

/**
 * Obyekt tomoni tashkilot TURI bilan emas, egalik bilan aniqlanadi. Ilgari bu yerda
 * kinds.includes('TERMINAL') turardi va shahobchasini da'vo qilib olgan korxona
 * o'z buyurtmasini ko'rmasdi.
 */
const m = (orgId: string, isOwner: boolean, roles: string[]) => ({ orgId, isOwner, roles });

describe('obyekt tomonidagi tashkilotlar', () => {
  it('shahobcha egasi (ASSET_OWNER roli) kiradi', () => {
    expect(terminalSideOrgIds([m('o1', false, ['ASSET_OWNER'])])).toEqual(['o1']);
  });

  it('tashkilot egasi rolsiz ham kiradi', () => {
    expect(terminalSideOrgIds([m('o1', true, [])])).toEqual(['o1']);
  });

  it('terminal xodimi va operatori kiradi', () => {
    expect(terminalSideOrgIds([m('o1', false, ['TERMINAL_ADMIN']), m('o2', false, ['TERMINAL_OPERATOR'])])).toEqual(['o1', 'o2']);
  });

  it("begona rol kirmaydi: yuk egasi tomonidagi a'zolik obyekt buyurtmasini ko'rmaydi", () => {
    expect(terminalSideOrgIds([m('o1', false, ['CLIENT', 'FORWARDER'])])).toEqual([]);
  });

  it("bo'sh ro'yxat bo'sh qaytadi", () => {
    expect(terminalSideOrgIds([])).toEqual([]);
  });
});
