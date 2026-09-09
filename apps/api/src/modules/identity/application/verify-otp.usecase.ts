import { Inject, Injectable } from '@nestjs/common';
import { OTP, normalizeUzPhone } from '@yuksaroy/domain';
import { OTP_STORE, USER_REPOSITORY, type OtpStore, type UserRecord, type UserRepository } from '../domain/ports';
import { OtpInvalidError, PhoneTakenError } from '../domain/errors';
import { hashSecret } from '../domain/otp';
import { env } from '../../../common/env';
import { TokenService } from './token.service';

export { OtpInvalidError, PhoneTakenError };

@Injectable()
export class VerifyOtpUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(OTP_STORE) private readonly otps: OtpStore,
    private readonly tokens: TokenService,
  ) {}

  /** Kodni tekshiradi va yoqadi; normallashgan telefonni qaytaradi. Parol tiklash va telefon almashtirish ham shu yerdan. */
  async consume(rawPhone: string, code: string): Promise<string> {
    const phone = normalizeUzPhone(rawPhone);
    if (!phone) throw new OtpInvalidError('NOT_FOUND');

    const challenge = await this.otps.latestActive(phone);
    if (!challenge) throw new OtpInvalidError('NOT_FOUND');
    if (challenge.expiresAt < new Date()) throw new OtpInvalidError('EXPIRED');
    if (challenge.attempts >= OTP.maxAttempts) throw new OtpInvalidError('LOCKED');

    if (challenge.codeHash !== hashSecret(code.trim(), env.JWT_SECRET)) {
      const n = await this.otps.bumpAttempts(challenge.id);
      throw new OtpInvalidError(n >= OTP.maxAttempts ? 'LOCKED' : 'WRONG');
    }
    await this.otps.consume(challenge.id);
    return phone;
  }

  /** `currentUserId`: kirgan, telefoni yo'q foydalanuvchi (Google) telefonni o'ziga bog'laydi, yangi user ochilmaydi. */
  async execute(rawPhone: string, code: string, ctx: { userAgent?: string; ip?: string }, currentUserId: string | null = null) {
    const phone = await this.consume(rawPhone, code);

    const me = currentUserId ? await this.users.findById(currentUserId) : null;
    let user: UserRecord;
    if (me && me.phone === null) {
      user = await this.users.claimPhone(me.id, phone); // bo'sh bot-user bo'lsa yutiladi, aks holda PhoneTakenError
    } else {
      user = (await this.users.findByPhone(phone)) ?? (await this.users.createByPhone(phone));
    }
    const pair = await this.tokens.issuePair(user.id, ctx);
    return { user, ...pair };
  }
}
