import { Inject, Injectable } from '@nestjs/common';
import { OTP, normalizePhone } from '@yuksaroy/domain';
import { OTP_SENDER, OTP_STORE, USER_REPOSITORY, type OtpSender, type OtpStore, type UserRepository } from '../domain/ports';
import { generateOtpCode, hashSecret, otpExpiry, randomToken } from '../domain/otp';
import { env } from '../../../common/env';

export type RequestOtpResult =
  | { status: 'SENT'; resendAfter: number }
  | { status: 'LINK_REQUIRED'; botUrl: string; linkToken: string; resendAfter: number };

/**
 * Web'dan telefon keldi. Telefon botga bog'langan bo'lsa - kod darhol Telegramga ketadi.
 * Bog'lanmagan bo'lsa - deep-link beriladi; bot kontaktni olgach kodni o'zi yuboradi (link-telegram.usecase).
 */
@Injectable()
export class RequestOtpUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(OTP_STORE) private readonly otps: OtpStore,
    @Inject(OTP_SENDER) private readonly sender: OtpSender,
  ) {}

  async execute(rawPhone: string, locale?: string | null): Promise<RequestOtpResult> {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new InvalidPhoneError();

    const last = await this.otps.latestActive(phone);
    if (last && Date.now() - last.createdAt.getTime() < OTP.resendAfterSeconds * 1000) {
      throw new TooManyRequestsError(Math.ceil((OTP.resendAfterSeconds * 1000 - (Date.now() - last.createdAt.getTime())) / 1000));
    }

    const code = generateOtpCode();
    const user = await this.users.findByPhone(phone);
    const linked = user?.telegramChatId ?? null;
    const linkToken = linked ? null : randomToken();

    await this.otps.create({ phone, codeHash: hashSecret(code, env.JWT_SECRET), expiresAt: otpExpiry(), linkToken });

    if (linked) {
      // Profil tili ustun: odam platformada tilni tanlagan bo'lsa, kod ham shu tilda
      await this.sender.sendCode(linked, code, user?.locale ?? locale ?? null);
      return { status: 'SENT', resendAfter: OTP.resendAfterSeconds };
    }
    return {
      status: 'LINK_REQUIRED',
      linkToken: linkToken!,
      botUrl: `https://t.me/${env.BOT_USERNAME}?start=login_${linkToken}`,
      resendAfter: OTP.resendAfterSeconds,
    };
  }
}

export class InvalidPhoneError extends Error {
  constructor() { super('INVALID_PHONE'); }
}
export class TooManyRequestsError extends Error {
  constructor(public readonly retryAfter: number) { super('TOO_MANY_REQUESTS'); }
}
