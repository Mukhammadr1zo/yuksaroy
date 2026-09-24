import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { LISTING, SERVICE_CODES, TARIFF_UNITS, TERMINAL_KINDS, TERMINAL_STATUSES, type ServiceCode, type TariffUnit, type TerminalKind, type TerminalStatus } from '@yuksaroy/domain';
import type { WeekHours } from '../domain/ports';
import { PHOTO_URL } from '../../../common/file-url';

export class CreateTerminalDto {
  @IsString() orgId!: string;
  @IsOptional() @IsString() stationId?: string;
  @IsOptional() @Matches(/^\d{5,6}$/) stationEsr?: string;
  @IsIn(TERMINAL_KINDS) kind!: TerminalKind;
  @IsString() @Length(2, 120) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
  @IsOptional() @IsBoolean() is24h?: boolean;
  @IsOptional() @IsObject() hours?: WeekHours;
  @IsOptional() @IsObject() passport?: Record<string, unknown>;
  // ValidateIf, IsOptional emas: IsOptional null ni ham o'tkazib yuboradi va Prisma skalyar
  // ro'yxatga null yozolmay 500 beradi. Shunda null @IsArray() ga tushib 400 bo'ladi.
  @ValidateIf((o: { photos?: unknown }) => o.photos !== undefined) @IsArray() @ArrayMaxSize(LISTING.maxPhotos) @Matches(PHOTO_URL, { each: true }) @MaxLength(500, { each: true }) photos?: string[];
}

export class UpdateTerminalDto extends PartialType(OmitType(CreateTerminalDto, ['orgId'] as const)) {
  @IsOptional() @IsIn(TERMINAL_STATUSES) status?: TerminalStatus;
}

/**
 * Shahobcha yo'lni egasi tahrir qiladi. Reestr ma'lumoti (raqam, stansiya, uzunlik,
 * sig'im) o'zgarmaydi - u rasmiy manbadan keladi. Hozircha faqat rasmlar.
 */
export class UpdateSidingDto {
  @ValidateIf((o: { photos?: unknown }) => o.photos !== undefined) @IsArray() @ArrayMaxSize(LISTING.maxPhotos) @IsString({ each: true }) @MaxLength(500, { each: true }) photos?: string[];
}

export class ServiceItemDto {
  @IsIn(SERVICE_CODES) serviceCode!: ServiceCode;
  @IsOptional() @IsBoolean() isEnabled?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(7 * 24 * 60) leadTimeMin?: number;
}
export class ReplaceServicesDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ServiceItemDto) services!: ServiceItemDto[];
}

export class PublishTariffDto {
  @IsIn(SERVICE_CODES) serviceCode!: ServiceCode;
  @IsOptional() @Matches(/^\d{6}$/) cargoGroupCode?: string;
  @IsInt() @Min(0) @Max(1e13) priceTiyin!: number;
  @IsIn(TARIFF_UNITS) unit!: TariffUnit;
  @IsOptional() @IsInt() @Min(0) @Max(1e13) minTiyin?: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class ClaimSidingDto {
  @IsString() orgId!: string;
  /** Izoh majburiy: operator "meniki" degan gapni nimaga qarab tekshirishini bilishi kerak. */
  @IsString() @Length(10, 500) note!: string;
  /** Hujjat ixtiyoriy; manzil va shakl tekshiruvi filesOrThrow da (faqat o'z domenimizdagi fayl). */
  @IsOptional() @IsArray() files?: unknown[];
}
export class ClaimDecideDto {
  @IsBoolean() approve!: boolean;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
