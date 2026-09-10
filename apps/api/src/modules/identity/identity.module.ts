import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OTP_SENDER, OTP_STORE, SESSION_STORE, USER_REPOSITORY } from './domain/ports';
import { RequestOtpUseCase } from './application/request-otp.usecase';
import { VerifyOtpUseCase } from './application/verify-otp.usecase';
import { GoogleLoginUseCase } from './application/google-login.usecase';
import { TelegramWebAppUseCase } from './application/telegram-webapp.usecase';
import { LinkTelegramUseCase } from './application/link-telegram.usecase';
import { PasswordUseCase } from './application/password.usecase';
import { DeleteAccountUseCase } from './application/delete-account.usecase';
import { TokenService } from './application/token.service';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { PrismaOtpStore } from './infrastructure/prisma-otp.store';
import { PrismaSessionStore } from './infrastructure/prisma-session.store';
import { TelegramOtpSender } from './infrastructure/telegram-otp.sender';
import { AuthController } from './presentation/auth.controller';
import { JwtGuard } from './presentation/jwt.guard';
import { InternalGuard } from './presentation/internal.guard';
import { PlatformAdmin } from '../organizations/application/platform-admin';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: OTP_STORE, useClass: PrismaOtpStore },
    { provide: SESSION_STORE, useClass: PrismaSessionStore },
    { provide: OTP_SENDER, useClass: TelegramOtpSender },
    RequestOtpUseCase, VerifyOtpUseCase, GoogleLoginUseCase, TelegramWebAppUseCase, LinkTelegramUseCase, PasswordUseCase, DeleteAccountUseCase, TokenService, JwtGuard, InternalGuard,
    // ponytail: PlatformAdmin faqat global PrismaService ga bog'liq, shuning uchun OrganizationsModule ni aylanma import qilmasdan shu yerda ham beriladi
    PlatformAdmin,
  ],
  exports: [TokenService, JwtGuard, USER_REPOSITORY, SESSION_STORE, DeleteAccountUseCase],
})
export class IdentityModule {}
