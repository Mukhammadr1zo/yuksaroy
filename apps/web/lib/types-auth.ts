// Auth sahifalari uchun API javob shakllari (identity va organizations modullari). lib/types.ts ga tegilmaydi.
import type { KycStatus, OrgKind, RegionCode } from '@yuksaroy/domain';

export interface Me {
  id: string; phone: string | null; email: string | null; avatarUrl: string | null; fullName: string | null;
  locale: string | null; personalRoles: string[]; telegramLinked: boolean; googleLinked: boolean; hasPassword: boolean;
  isPlatformAdmin: boolean; /** Platformani o'zgartirish huquqi: operatorda yo'q. */ isPlatformOwner: boolean; createdAt: string;
}
/** OTP verify, Google va parol bilan kirish bir xil javob beradi. */
export interface LoginResponse { user: Me; accessToken: string; refreshToken: string; needsPhone: boolean }
export interface OtpRequestResponse { status: 'SENT' | 'LINK_REQUIRED'; botUrl?: string; resendAfter: number }
export interface OrgRecord {
  id: string; slug: string | null; name: string; kind: OrgKind; kinds: OrgKind[]; kycStatus: KycStatus; stir: string | null; regionCode: RegionCode | null;
}
