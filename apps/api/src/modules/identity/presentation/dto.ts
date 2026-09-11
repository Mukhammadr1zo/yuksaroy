import { IsArray, IsEmail, IsIn, IsOptional, IsString, IsUrl, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD } from '@yuksaroy/domain';

const PHONE = /^[+\d\s()-]{9,17}$/;

export class RequestOtpDto {
  @IsString() @Matches(PHONE) phone!: string;
  /** Brauzerdagi til: hisobi yo'q foydalanuvchi ham kodni o'z tilida oladi. */
  @IsOptional() @IsIn(['uz', 'ru', 'en']) locale?: 'uz' | 'ru' | 'en';
}
export class VerifyOtpDto {
  @IsString() @Matches(PHONE) phone!: string;
  @IsString() @Length(6, 6) code!: string;
}
export class TelegramLinkDto {
  @IsString() chatId!: string;
  @IsString() phone!: string;
  username?: string;
  linkToken?: string;
}
/** Google Identity Services `credential` (ID token JWT). */
export class GoogleLoginDto {
  @IsString() @Length(20, 4096) credential!: string;
}
/** Telegram Mini App: WebApp.initData (bot imzolagan) va ixtiyoriy start_param. */
export class TelegramWebAppDto {
  @IsString() @Length(1, 8192) initData!: string;
  @IsOptional() @IsString() @MaxLength(512) startParam?: string;
}
export class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(120) fullName?: string;
  @IsOptional() @IsIn(['uz', 'ru', 'en']) locale?: 'uz' | 'ru' | 'en';
  @IsOptional() @IsEmail() @MaxLength(160) email?: string | null;
  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(500) avatarUrl?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) personalRoles?: string[];
}
export class LoginDto {
  @IsString() @Matches(PHONE) phone!: string;
  @IsString() @Length(1, 200) password!: string;
}
export class SetPasswordDto {
  @IsString() @MinLength(PASSWORD.minLength) @MaxLength(200) password!: string;
  /** Allaqachon parol o'rnatilgan bo'lsa, uni o'zgartirish uchun joriy parol shart
   * (o'g'irlangan sessiya jim parolni almashtira olmasin). Birinchi o'rnatishda kerak emas. */
  @IsOptional() @IsString() @MaxLength(200) currentPassword?: string;
}
export class ResetPasswordDto extends VerifyOtpDto {
  @IsString() @MinLength(PASSWORD.minLength) @MaxLength(200) password!: string;
}
export class DeleteMeDto {
  @IsString() @Length(1, 30) confirm!: string;
}
