import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Inject, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiTags } from '@nestjs/swagger';
import { PERSONAL_ROLES, normalizePhone, type Role } from '@yuksaroy/domain';
import { RequestOtpUseCase, InvalidPhoneError, TooManyRequestsError } from '../application/request-otp.usecase';
import { VerifyOtpUseCase } from '../application/verify-otp.usecase';
import { GoogleLoginUseCase, GoogleDisabledError, GoogleInvalidError } from '../application/google-login.usecase';
import { TelegramWebAppUseCase, TgInitDataError } from '../application/telegram-webapp.usecase';
import { LinkTelegramUseCase } from '../application/link-telegram.usecase';
import { PasswordUseCase } from '../application/password.usecase';
import { DeleteAccountUseCase } from '../application/delete-account.usecase';
import { TokenService, ACCESS_TTL_SEC, REFRESH_TTL_SEC } from '../application/token.service';
import { BadCredentialsError, LoginLockedError, NoPasswordError, OtpInvalidError, PhoneTakenError } from '../domain/errors';
import { deleteConfirmed } from '../domain/account';
import { DeleteMeDto, GoogleLoginDto, LoginDto, RequestOtpDto, ResetPasswordDto, SetPasswordDto, TelegramLinkDto, TelegramWebAppDto, UpdateMeDto, VerifyOtpDto } from './dto';
import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_FLAG_COOKIE, CurrentUserId, JwtGuard, optionalUserId } from './jwt.guard';
import { InternalGuard } from './internal.guard';
import { USER_REPOSITORY, type UserPatch, type UserRecord, type UserRepository } from '../domain/ports';
import { PlatformAdmin } from '../../organizations/application/platform-admin';
import { AuditService } from '../../../common/audit.service';
import { env } from '../../../common/env';
import { IpBucket } from '../../../common/ip-bucket';

const cookieBase = { httpOnly: true, sameSite: 'lax' as const, secure: env.NODE_ENV === 'production', path: '/' };
const tgBucket = new IpBucket(30, 60_000); // Mini App kirish: bitta IP daqiqasiga 30 ta
const otpBucket = new IpBucket(10, 3_600_000); // otp/request: bitta IP soatiga 10 ta
const loginBucket = new IpBucket(20, 600_000); // login: bitta IP 10 daqiqada 20 ta
const resetBucket = new IpBucket(5, 3_600_000); // parol tiklash so'rovi: bitta IP soatiga 5 ta
// Kodni ISTE'MOL qiluvchi yo'llar (verify/reset/phone-change): brute-force to'sig'i. Ilgari bular
// umuman cheklanmasdi - faqat kod bo'yicha 3 urinish bor edi, lekin ko'p kod olib chetlab o'tilardi.
const consumeIpBucket = new IpBucket(15, 600_000);   // bitta IP 10 daqiqada 15 tekshiruv
const consumePhoneBucket = new IpBucket(8, 600_000);  // bitta raqamga 10 daqiqada 8 tekshiruv
const otpPhoneBucket = new IpBucket(5, 3_600_000);    // bitta raqamga soatiga 5 kod so'rovi (Telegram toshqini)
/** Chelak oshsa 429; kalit sifatida IP. */
const limit = (b: IpBucket, req: FastifyRequest) => { if (!b.take(req.ip ?? '?')) throw new HttpException({ code: 'RATE_LIMITED' }, 429); };
/** Telefon bo'yicha cheklov: bitta IP butun tarmoqni bloklamaydi, bitta raqam nishonlanmaydi. */
const limitPhone = (b: IpBucket, phone: string | null) => { if (phone && !b.take(phone)) throw new HttpException({ code: 'RATE_LIMITED' }, 429); };
/** Kod iste'mol qiluvchi yo'l: IP va telefon bo'yicha, VerifyOtpUseCase'dan oldin. */
const limitConsume = (req: FastifyRequest, phone: string | null) => { limit(consumeIpBucket, req); limitPhone(consumePhoneBucket, normalizePhone(phone ?? '')); };
type Ctx = { userAgent?: string; ip?: string };
const ctxOf = (req: FastifyRequest): Ctx => ({ userAgent: req.headers['user-agent'], ip: req.ip });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly requestOtp: RequestOtpUseCase,
    private readonly verifyOtp: VerifyOtpUseCase,
    private readonly googleLogin: GoogleLoginUseCase,
    private readonly tgWebApp: TelegramWebAppUseCase,
    private readonly linkTelegram: LinkTelegramUseCase,
    private readonly password: PasswordUseCase,
    private readonly deleteAccount: DeleteAccountUseCase,
    private readonly tokens: TokenService,
    private readonly admin: PlatformAdmin,
    private readonly audit: AuditService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  @Post('otp/request') @HttpCode(200)
  async otpRequest(@Body() dto: RequestOtpDto, @Req() req: FastifyRequest) {
    limit(otpBucket, req);
    limitPhone(otpPhoneBucket, normalizePhone(dto.phone));
    return this.otpRequestOrThrow(dto.phone, dto.locale);
  }

  /** Kirgan telefonsiz foydalanuvchi (Google) shu yerda telefonini bog'laydi: yangi user ochilmaydi. */
  @Post('otp/verify') @HttpCode(200)
  async otpVerify(@Body() dto: VerifyOtpDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    limitConsume(req, dto.phone);
    try {
      const r = await this.verifyOtp.execute(dto.phone, dto.code, ctxOf(req), optionalUserId(req, this.tokens));
      return await this.loggedIn(res, r, req.ip, 'otp');
    } catch (e) {
      throw this.authError(e);
    }
  }

  @Post('google') @HttpCode(200)
  async google(@Body() dto: GoogleLoginDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    try {
      const r = await this.googleLogin.execute(dto.credential, ctxOf(req));
      return await this.loggedIn(res, r, req.ip, 'google');
    } catch (e) {
      if (e instanceof GoogleDisabledError) throw new HttpException({ code: 'GOOGLE_DISABLED' }, 503);
      if (e instanceof GoogleInvalidError) throw new HttpException({ code: 'GOOGLE_INVALID' }, 401);
      throw e;
    }
  }

  /** Telegram Mini App: imzolangan initData -> chat bo'yicha user (yo'q bo'lsa telefonsiz yaratiladi, needsPhone). startParam: imzolangan start_param, bo'lmasa mijoz yuborgani. */
  @Post('telegram-webapp') @HttpCode(200)
  async telegramWebApp(@Body() dto: TelegramWebAppDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    limit(tgBucket, req);
    try {
      const r = await this.tgWebApp.execute(dto.initData, ctxOf(req));
      return { ...(await this.loggedIn(res, r, req.ip, 'telegram_webapp', 'auth.telegram_webapp')), startParam: r.startParam ?? dto.startParam ?? null };
    } catch (e) {
      if (e instanceof TgInitDataError) throw new HttpException({ code: e.code }, 401);
      throw e;
    }
  }

  /** Telefon + parol. Noma'lum telefon va noto'g'ri parol bir xil javob (BAD_CREDENTIALS). */
  @Post('login') @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    limit(loginBucket, req);
    try {
      const r = await this.password.login(dto.phone, dto.password, ctxOf(req));
      return await this.loggedIn(res, r, req.ip, 'password');
    } catch (e) {
      throw this.authError(e);
    }
  }

  @Post('password/set') @HttpCode(200) @UseGuards(JwtGuard)
  async passwordSet(@CurrentUserId() userId: string, @Body() dto: SetPasswordDto, @Req() req: FastifyRequest) {
    const u = await this.password.setPasswordChecked(userId, dto.password, dto.currentPassword);
    await this.audit.log({ actorId: userId, action: 'auth.password.set', ip: req.ip });
    return publicUser(u, await perms(this.admin, userId));
  }

  @Post('password/reset/request') @HttpCode(200)
  async passwordResetRequest(@Body() dto: RequestOtpDto, @Req() req: FastifyRequest) {
    limit(resetBucket, req);
    limitPhone(otpPhoneBucket, normalizePhone(dto.phone));
    return this.otpRequestOrThrow(dto.phone, dto.locale);
  }

  @Post('password/reset') @HttpCode(200)
  async passwordReset(@Body() dto: ResetPasswordDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    limitConsume(req, dto.phone);
    try {
      const r = await this.password.reset(dto.phone, dto.code, dto.password, ctxOf(req));
      await this.audit.log({ actorId: r.user.id, action: 'auth.password.reset', ip: req.ip });
      return await this.loggedIn(res, r, req.ip, 'password_reset');
    } catch (e) {
      throw this.authError(e);
    }
  }

  @Post('refresh') @HttpCode(200)
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply, @Body() body: { refreshToken?: string }) {
    const token = body?.refreshToken ?? (req as any).cookies?.[REFRESH_COOKIE];
    const r = await this.tokens.refresh(token);
    this.setCookies(res, r.accessToken, r.refreshToken);
    return { accessToken: r.accessToken, refreshToken: r.refreshToken };
  }

  @Post('logout') @HttpCode(204)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply, @Body() body: { refreshToken?: string }) {
    // Mini App refresh tokenni tanada yuboradi, sayt cookie'dan (path '/')
    await this.tokens.logout(body?.refreshToken ?? (req as any).cookies?.[REFRESH_COOKIE]);
    this.clearCookies(res);
  }

  @Get('me') @UseGuards(JwtGuard)
  async me(@CurrentUserId() userId: string) {
    const u = await this.users.findById(userId);
    if (!u) throw new HttpException({ code: 'USER_NOT_FOUND' }, HttpStatus.UNAUTHORIZED);
    return publicUser(u, await perms(this.admin, u.id));
  }

  /** Email yagona (EMAIL_TAKEN) va Google bog'langanda o'zgarmaydi (EMAIL_LOCKED); personalRoles faqat PERSONAL_ROLES. */
  @Patch('me') @UseGuards(JwtGuard)
  async updateMe(@CurrentUserId() userId: string, @Body() dto: UpdateMeDto) {
    const me = await this.users.findById(userId);
    if (!me) throw new HttpException({ code: 'USER_NOT_FOUND' }, HttpStatus.UNAUTHORIZED);
    const patch: UserPatch = { fullName: dto.fullName?.trim(), locale: dto.locale };
    if (dto.email !== undefined) {
      const email = dto.email?.trim().toLowerCase() || null;
      if (email !== me.email) {
        if (me.googleSub) throw new HttpException({ code: 'EMAIL_LOCKED' }, 400);
        if (email && (await this.users.findByEmail(email))) throw new HttpException({ code: 'EMAIL_TAKEN' }, 409);
        patch.email = email;
      }
    }
    if (dto.avatarUrl !== undefined) patch.avatarUrl = dto.avatarUrl || null;
    if (dto.personalRoles) patch.personalRoles = dto.personalRoles.filter((r): r is Role => PERSONAL_ROLES.includes(r as Role));
    const u = await this.users.update(userId, patch);
    return publicUser(u, await perms(this.admin, u.id));
  }

  /** Telefon almashtirish: kod YANGI raqamga (o'sha OTP oqimi), keyin /phone/change kod bilan. */
  @Post('phone/change/request') @HttpCode(200) @UseGuards(JwtGuard)
  async phoneChangeRequest(@CurrentUserId() userId: string, @Body() dto: RequestOtpDto) {
    const phone = normalizePhone(dto.phone);
    const me = await this.users.findById(userId);
    if (phone && me?.phone === phone) throw new HttpException({ code: 'SAME_PHONE' }, 400);
    return this.otpRequestOrThrow(dto.phone, dto.locale);
  }

  @Post('phone/change') @HttpCode(200) @UseGuards(JwtGuard)
  async phoneChange(@CurrentUserId() userId: string, @Body() dto: VerifyOtpDto, @Req() req: FastifyRequest) {
    limitConsume(req, dto.phone);
    try {
      const phone = await this.verifyOtp.consume(dto.phone, dto.code);
      const u = await this.users.claimPhone(userId, phone);
      await this.audit.log({ actorId: userId, action: 'auth.phone.change', ip: req.ip });
      return publicUser(u, await perms(this.admin, userId));
    } catch (e) {
      throw this.authError(e);
    }
  }

  /** Hisobni o'chirish (soft): tasdiq 'DELETE' yoki o'z telefoni. Buyurtma va hujjatlar qoladi. */
  @Post('me/delete') @HttpCode(200) @UseGuards(JwtGuard)
  async deleteMe(@CurrentUserId() userId: string, @Body() dto: DeleteMeDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const me = await this.users.findById(userId);
    if (!me) throw new HttpException({ code: 'USER_NOT_FOUND' }, HttpStatus.UNAUTHORIZED);
    if (!deleteConfirmed(dto.confirm, me.phone, normalizePhone)) throw new HttpException({ code: 'CONFIRM_MISMATCH' }, 400);
    const report = await this.deleteAccount.execute(userId);
    await this.audit.log({ actorId: userId, action: 'auth.delete', entity: 'User', entityId: userId, ip: req.ip, meta: report });
    this.clearCookies(res);
    return { deleted: true, transferred: report.transferred.length, orphanedOrgs: report.orphaned.length };
  }

  /** Bot -> API: kontakt keldi. */
  @Post('internal/telegram/link') @HttpCode(200) @UseGuards(InternalGuard)
  async telegramLink(@Body() dto: TelegramLinkDto) {
    return this.linkTelegram.execute({ chatId: BigInt(dto.chatId), username: dto.username ?? null, phone: dto.phone, linkToken: dto.linkToken });
  }

  private async otpRequestOrThrow(phone: string, locale?: string | null) {
    try {
      return await this.requestOtp.execute(phone, locale ?? null);
    } catch (e) {
      if (e instanceof InvalidPhoneError) throw new HttpException({ code: 'INVALID_PHONE' }, 400);
      if (e instanceof TooManyRequestsError) throw new HttpException({ code: 'TOO_MANY_REQUESTS', retryAfter: e.retryAfter }, 429);
      throw e;
    }
  }

  /** Domen xatolari -> HTTP. Tanilmagan xato o'zgarmay qaytadi. */
  private authError(e: unknown): unknown {
    if (e instanceof OtpInvalidError) return new HttpException({ code: `OTP_${e.reason}` }, e.reason === 'LOCKED' ? 423 : 400);
    if (e instanceof PhoneTakenError) return new HttpException({ code: 'PHONE_TAKEN' }, 409);
    if (e instanceof BadCredentialsError) return new HttpException({ code: 'BAD_CREDENTIALS' }, 401);
    if (e instanceof NoPasswordError) return new HttpException({ code: 'NO_PASSWORD' }, 400);
    if (e instanceof LoginLockedError) return new HttpException({ code: 'LOGIN_LOCKED', retryAfter: e.retryAfter }, 423);
    return e;
  }

  /** OTP, Google va parol uchun bir xil: cookie, audit, javob shakli. */
  private async loggedIn(res: FastifyReply, r: { user: UserRecord; accessToken: string; refreshToken: string }, ip: string, via: string, action = 'auth.login') {
    this.setCookies(res, r.accessToken, r.refreshToken);
    await this.audit.log({ actorId: r.user.id, action, ip, meta: { via } });
    return { user: publicUser(r.user, await perms(this.admin, r.user.id)), accessToken: r.accessToken, refreshToken: r.refreshToken, needsPhone: r.user.phone === null };
  }

  private setCookies(res: FastifyReply, access: string, refresh: string) {
    res.setCookie(ACCESS_COOKIE, access, { ...cookieBase, maxAge: ACCESS_TTL_SEC });
    res.setCookie(REFRESH_COOKIE, refresh, { ...cookieBase, maxAge: REFRESH_TTL_SEC });
    // httpOnly emas: brauzer o'qiy oladi va mehmon uchun /auth/me va /auth/refresh so'rovlari umuman yuborilmaydi
    res.setCookie(SESSION_FLAG_COOKIE, '1', { ...cookieBase, httpOnly: false, maxAge: REFRESH_TTL_SEC });
  }
  private clearCookies(res: FastifyReply) {
    // Brauzer /api/v1/... ga so'rov yuboradi, shuning uchun refresh cookie ham path '/'; eski /v1/auth qoldig'i ham tozalanadi
    res.clearCookie(ACCESS_COOKIE, { path: '/' }); res.clearCookie(REFRESH_COOKIE, { path: '/' }); res.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
    res.clearCookie(SESSION_FLAG_COOKIE, { path: '/' });
  }
}

/**
 * Ikki bayroq: admin panelga kirish va platformani o'zgartirish huquqi.
 *
 * Ikkinchisi UI uchun: operator komissiya sozlamasini yoki o'chirish tugmasini
 * ko'rmasligi kerak. Haqiqiy himoya baribir serverda, PlatformOwnerGuard da.
 */
export function publicUser(u: UserRecord, perms: { isPlatformAdmin: boolean; isPlatformOwner: boolean }) {
  return {
    id: u.id, phone: u.phone, email: u.email, avatarUrl: u.avatarUrl, fullName: u.fullName, locale: u.locale, personalRoles: u.personalRoles,
    telegramLinked: u.telegramChatId !== null, googleLinked: u.googleSub !== null, hasPassword: u.passwordHash !== null,
    isPlatformAdmin: perms.isPlatformAdmin, isPlatformOwner: perms.isPlatformOwner, createdAt: u.createdAt.toISOString(),
  };
}

/** Ikkala tekshiruv birga: chaqiruv joylari ko'p, har birida takrorlanmasin. */
export async function perms(admin: { isPlatformAdmin(id: string): Promise<boolean>; isPlatformOwner(id: string): Promise<boolean> }, userId: string) {
  const [isPlatformAdmin, isPlatformOwner] = await Promise.all([admin.isPlatformAdmin(userId), admin.isPlatformOwner(userId)]);
  return { isPlatformAdmin, isPlatformOwner };
}
