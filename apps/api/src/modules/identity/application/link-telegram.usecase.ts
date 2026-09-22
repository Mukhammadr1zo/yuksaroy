import { Inject, Injectable } from '@nestjs/common';
import { normalizePhone } from '@yuksaroy/domain';
import { OTP_SENDER, OTP_STORE, USER_REPOSITORY, type OtpSender, type OtpStore, type UserRepository } from '../domain/ports';
import { PhoneTakenError } from '../domain/errors';
import { generateOtpCode, hashSecret, otpExpiry } from '../domain/otp';
import { env } from '../../../common/env';

export interface LinkTelegramInput {
  chatId: bigint;
  username: string | null;
  phone: string;       // Telegram contact (foydalanuvchining o'z raqami)
  linkToken?: string;  // /start login_<token> dan
}

/**
 * Bot kontakt oldi: telefon ↔ chat bog'lanadi (user bo'lmasa yaratiladi).
 * Agar web'da kutayotgan OTP (linkToken) bo'lsa: kod shu chatga yuboriladi.
 */
@Injectable()
export class LinkTelegramUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(OTP_STORE) private readonly otps: OtpStore,
    @Inject(OTP_SENDER) private readonly sender: OtpSender,
  ) {}

  async execute(input: LinkTelegramInput): Promise<{ linked: true; codeSent: boolean }> {
    const phone = normalizePhone(input.phone);
    if (!phone) throw new Error('INVALID_PHONE');

    // Mini App orqali ochilgan telefonsiz user (chat allaqachon bog'langan): telefon shu userga, yangi user ochilmaydi
    let user = await this.users.findByTelegramChat(input.chatId);
    if (user?.phone === null) {
      try { user = await this.users.claimPhone(user.id, phone); } catch (e) { if (!(e instanceof PhoneTakenError)) throw e; user = null; }
    }
    if (!user || user.phone !== phone) user = (await this.users.findByPhone(phone)) ?? (await this.users.createByPhone(phone));
    await this.users.linkTelegram(user.id, input.chatId, input.username);

    // Web'da kutayotgan urinish bormi? Token bo'lsa: aynan o'sha; bo'lmasa telefon bo'yicha oxirgi faol.
    const pending = input.linkToken ? await this.otps.findByLinkToken(input.linkToken) : await this.otps.latestActive(phone);
    if (!pending || pending.phone !== phone || pending.consumedAt || pending.expiresAt < new Date()) {
      return { linked: true, codeSent: false };
    }

    // Eski kod hash'i web'da yaratilgan; kodni bilmaymiz: yangi kod yaratib almashtiramiz.
    const code = generateOtpCode();
    await this.otps.consume(pending.id);
    await this.otps.create({ phone, codeHash: hashSecret(code, env.JWT_SECRET), expiresAt: otpExpiry(), linkToken: null });
    const u = await this.users.findByPhone(phone);
    await this.sender.sendCode(input.chatId, code, u?.locale ?? null);
    return { linked: true, codeSent: true };
  }
}
