// identity: domen portlari. Framework va Prisma bu faylda yo'q.
import type { Role } from '@yuksaroy/domain';

export interface UserRecord {
  id: string;
  /** Google orqali kirganda bo'sh bo'lishi mumkin; OTP tasdiqlash bilan keyin bog'lanadi. */
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  fullName: string | null;
  locale: string;
  personalRoles: Role[];
  isActive: boolean;
  telegramChatId: bigint | null;
  googleSub: string | null;
  passwordHash: string | null;
  failedLogins: number;
  lockedUntil: Date | null;
  createdAt: Date;
}

export interface UserPatch {
  phone?: string | null; fullName?: string | null; locale?: string; googleSub?: string | null; avatarUrl?: string | null; email?: string | null;
  personalRoles?: Role[]; isActive?: boolean;
  passwordHash?: string | null; passwordSetAt?: Date | null; failedLogins?: number; lockedUntil?: Date | null;
}

export interface UserRepository {
  findByPhone(phone: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findByGoogleSub(sub: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  createByPhone(phone: string): Promise<UserRecord>;
  createByGoogle(d: { googleSub: string; email: string; fullName: string | null; avatarUrl: string | null }): Promise<UserRecord>;
  /** Mini App: telefonsiz user + TelegramLink bitta so'rovda. */
  createByTelegram(d: { chatId: bigint; username: string | null; fullName: string | null; locale: string; avatarUrl: string | null }): Promise<UserRecord>;
  update(userId: string, d: UserPatch): Promise<UserRecord>;
  /** Telefonni shu userga beradi. Bot yaratgan bo'sh user (faqat telefon + Telegram) bo'lsa uni yutadi, aks holda PhoneTakenError. */
  claimPhone(userId: string, phone: string): Promise<UserRecord>;
  linkTelegram(userId: string, chatId: bigint, username: string | null): Promise<void>;
  findByTelegramChat(chatId: bigint): Promise<UserRecord | null>;
}

export interface OtpChallenge {
  id: string;
  phone: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  linkToken: string | null;
  createdAt: Date;
}

export interface OtpStore {
  create(c: { phone: string; codeHash: string; expiresAt: Date; linkToken: string | null }): Promise<OtpChallenge>;
  latestActive(phone: string): Promise<OtpChallenge | null>;
  findByLinkToken(token: string): Promise<OtpChallenge | null>;
  bumpAttempts(id: string): Promise<number>;
  consume(id: string): Promise<void>;
}

export interface OtpSender {
  /** Kodni foydalanuvchining Telegram chatiga yuboradi. */
  sendCode(chatId: bigint, code: string, locale?: string | null): Promise<void>;
}

export interface SessionStore {
  create(s: { userId: string; refreshHash: string; expiresAt: Date; userAgent?: string; ip?: string }): Promise<{ id: string }>;
  findByRefreshHash(hash: string): Promise<{ id: string; userId: string; expiresAt: Date; revokedAt: Date | null } | null>;
  findById(id: string): Promise<{ revokedAt: Date | null } | null>;
  rotate(oldId: string, next: { refreshHash: string; expiresAt: Date }): Promise<{ id: string }>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
export const OTP_STORE = Symbol('OtpStore');
export const OTP_SENDER = Symbol('OtpSender');
export const SESSION_STORE = Symbol('SessionStore');
