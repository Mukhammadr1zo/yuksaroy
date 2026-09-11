import { Inject, Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { USER_REPOSITORY, type UserRecord, type UserRepository } from '../domain/ports';
import { env } from '../../../common/env';
import { TokenService } from './token.service';

export class GoogleDisabledError extends Error { constructor() { super('GOOGLE_DISABLED'); } }
export class GoogleInvalidError extends Error { constructor() { super('GOOGLE_INVALID'); } }

/**
 * Google ID token (GSI credential) -> foydalanuvchi. googleSub bo'yicha topiladi yoki yangi hisob.
 * DIQQAT: mahalliy 'email' ustuni PATCH /me bilan TASDIQLANMASDAN qo'yiladi, shuning uchun unga
 * qarab hisobga BOG'LAMAYMIZ - aks holda begona odam qurbon emailini o'ziga yozib, uning Google
 * kirishini o'g'irlab olardi. Telefon bo'sh qoladi; OTP bilan keyin bog'lanadi (needsPhone).
 */
@Injectable()
export class GoogleLoginUseCase {
  private readonly client = new OAuth2Client();

  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository, private readonly tokens: TokenService) {}

  async execute(credential: string, ctx: { userAgent?: string; ip?: string }) {
    const audience = env.GOOGLE_CLIENT_ID;
    if (!audience) throw new GoogleDisabledError();
    let p: { sub: string; email: string; name: string | null; picture: string | null };
    try {
      const t = await this.client.verifyIdToken({ idToken: credential, audience });
      const payload = t.getPayload();
      if (!payload?.email || !payload.email_verified) throw new GoogleInvalidError();
      p = { sub: payload.sub, email: payload.email.toLowerCase(), name: payload.name ?? null, picture: payload.picture ?? null };
    } catch {
      throw new GoogleInvalidError();
    }

    let user: UserRecord | null = await this.users.findByGoogleSub(p.sub);
    if (!user) {
      // Email band bo'lsa (boshqa hisobda, tasdiqlanmagan) - uni bu yerda null qoldiramiz:
      // Google identifikatori googleSub orqali ishlaydi, band email yangi kirishni to'smasin.
      const taken = await this.users.findByEmail(p.email);
      user = await this.users.createByGoogle({ googleSub: p.sub, email: taken ? null : p.email, fullName: p.name, avatarUrl: p.picture });
    }
    const pair = await this.tokens.issuePair(user.id, ctx);
    return { user, ...pair };
  }
}
