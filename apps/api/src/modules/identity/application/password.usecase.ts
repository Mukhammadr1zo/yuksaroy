import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { normalizePhone } from '@yuksaroy/domain';
import { USER_REPOSITORY, type UserRepository } from '../domain/ports';
import { BadCredentialsError, LoginLockedError, NoPasswordError } from '../domain/errors';
import { afterLoginAttempt, lockRetryAfter } from '../domain/account';
import { TokenService } from './token.service';
import { VerifyOtpUseCase } from './verify-otp.usecase';

type Ctx = { userAgent?: string; ip?: string };

/** Parol bilan kirish, parol o'rnatish va OTP orqali tiklash. Hash: argon2id (kutubxona standarti). */
@Injectable()
export class PasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly tokens: TokenService,
    private readonly verifyOtp: VerifyOtpUseCase,
  ) {}

  async login(rawPhone: string, password: string, ctx: Ctx) {
    const phone = normalizePhone(rawPhone);
    const user = phone ? await this.users.findByPhone(phone) : null;
    // ponytail: noma'lum telefon uchun dummy argon2.verify yo'q; vaqt farqi bilan telefon aniqlash xavfi qabul qilingan
    if (!user || !user.isActive) throw new BadCredentialsError();
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) throw new LoginLockedError(lockRetryAfter(user.lockedUntil, now));
    if (!user.passwordHash) throw new NoPasswordError();

    const ok = await argon2.verify(user.passwordHash, password);
    const next = afterLoginAttempt(user, ok, now);
    await this.users.update(user.id, next);
    if (!ok) {
      if (next.lockedUntil) throw new LoginLockedError(lockRetryAfter(next.lockedUntil, now));
      throw new BadCredentialsError();
    }
    const pair = await this.tokens.issuePair(user.id, ctx);
    return { user, ...pair };
  }

  async setPassword(userId: string, password: string) {
    return this.users.update(userId, { passwordHash: await argon2.hash(password), passwordSetAt: new Date(), failedLogins: 0, lockedUntil: null });
  }

  /** Profilda parolni o'rnatish/almashtirish: parol allaqachon bo'lsa joriyini tekshiradi. */
  async setPasswordChecked(userId: string, password: string, current?: string) {
    const u = await this.users.findById(userId);
    if (!u) throw new BadCredentialsError();
    if (u.passwordHash && !(current && (await argon2.verify(u.passwordHash, current)))) throw new BadCredentialsError();
    return this.setPassword(userId, password);
  }

  /** OTP tasdiqlanadi, parol yangilanadi, kirish natijasi qaytadi (cookie controllerda). */
  async reset(rawPhone: string, code: string, password: string, ctx: Ctx) {
    const phone = await this.verifyOtp.consume(rawPhone, code);
    const existing = (await this.users.findByPhone(phone)) ?? (await this.users.createByPhone(phone));
    const user = await this.setPassword(existing.id, password);
    const pair = await this.tokens.issuePair(user.id, ctx);
    return { user, ...pair };
  }
}
