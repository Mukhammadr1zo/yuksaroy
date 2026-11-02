import { describe, expect, it, vi } from 'vitest';

const sent: { href: string }[] = [];
vi.mock('../../../common/telegram', () => ({ notifyBoth: async (_p: unknown, _n: unknown, o: { href: string }) => { sent.push(o); } }));
vi.mock('./platform-admin', () => ({ PlatformAdmin: class { adminUserIds = async () => ['a1']; } }));

import { noticeRenamedVerifiedOrg } from './org-rename-notice';

const call = (kycStatus: string, name: string | undefined) =>
  noticeRenamedVerifiedOrg({} as never, {} as never, { id: 'o1', name: 'Eski', kycStatus }, name, 'u1');

describe('tasdiqlangan tashkilot nomini o\'zgartirdi', () => {
  it('tasdiqlangan va nom boshqa: adminlarga xabar', async () => {
    sent.length = 0;
    expect(await call('VERIFIED', 'Yangi')).toBe(true);
    expect(sent.map((s) => s.href)).toEqual(['/admin/orgs/o1']);
  });
  it('nom bir xil yoki yuborilmagan yoki tasdiqlanmagan: jim', async () => {
    sent.length = 0;
    expect(await call('VERIFIED', ' Eski ')).toBe(false);
    expect(await call('VERIFIED', undefined)).toBe(false);
    expect(await call('NONE', 'Yangi')).toBe(false);
    expect(sent).toHaveLength(0);
  });
});
