import { describe, expect, it } from 'vitest';
import { terminalInquiryWhere } from './impressions.controller';

describe('terminalInquiryWhere', () => {
  it('terminalning o\'ziga yozilgan so\'rovni ham, e\'loniga yozilganini ham sanaydi', () => {
    const gte = new Date('2026-10-01T00:00:00Z');
    expect(terminalInquiryWhere('t1', gte)).toEqual({
      OR: [{ terminalId: 't1' }, { listing: { terminalId: 't1' } }],
      createdAt: { gte },
    });
  });
});
