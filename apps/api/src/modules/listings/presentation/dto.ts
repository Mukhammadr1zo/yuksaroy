import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, ValidateNested } from 'class-validator';
import { PHOTO_URL } from '../../../common/file-url';
import type { Condition, DealKind, ListingInput, ListingKind, PriceUnit, RegionCode } from '@yuksaroy/domain';

/** Faqat shakl tekshiruvi; lug'at va diapazon qoidalari validateListing'da (bir xil xato kodlari forma uchun). */
class RouteDto {
  @IsString() from!: RegionCode;
  @IsString() to!: RegionCode;
}

export class ListingBodyDto {
  @IsString() kind!: ListingKind;
  @IsOptional() @IsString() deal?: DealKind | null;
  @IsString() @Length(3, 140) title!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsString() regionCode!: RegionCode;
  @IsOptional() @IsString() terminalId?: string | null;
  @IsOptional() @IsInt() @Max(1e13) priceTiyin?: number | null;
  @IsOptional() @IsString() priceUnit?: PriceUnit | null;
  @IsOptional() @IsArray() @Matches(PHOTO_URL, { each: true }) @MaxLength(500, { each: true }) photos?: string[];
  @IsOptional() @IsInt() year?: number | null;
  @IsOptional() @IsString() condition?: Condition | null;
  @IsOptional() @IsString() @MaxLength(80) model?: string | null;
  @IsOptional() @IsInt() qty?: number;
  @IsOptional() @IsString() wagonType?: string | null;
  @IsOptional() @IsInt() capacityT?: number | null;
  @IsOptional() @IsString() truckType?: string | null;
  @IsOptional() @IsInt() tonnage?: number | null;
  @IsOptional() @IsInt() fleetSize?: number | null;
  @IsOptional() @IsArray() @IsString({ each: true }) serviceRegions?: RegionCode[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RouteDto) routes?: RouteDto[];
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string | null;
}

/** orgId bo'sh bo'lsa shaxsiy e'lon (yakka haydovchi, faqat TRUCK). */
export class CreateListingDto extends ListingBodyDto {
  @IsOptional() @IsString() orgId?: string | null;
}
export class UpdateListingDto extends PartialType(ListingBodyDto) {}

export class InquiryDto {
  @IsString() @Length(5, 1000) message!: string;
  @IsOptional() @IsString() orgId?: string;
  // Birinchi xabarga ham fayl ilashadi (shakl tekshiruvi common/attachments.ts da)
  @IsOptional() @IsArray() attachments?: unknown[];
}
export class DecideDto {
  @IsBoolean() approve!: boolean;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

const EMPTY: Omit<ListingInput, 'kind' | 'title' | 'regionCode'> = {
  deal: null, description: null, terminalId: null, priceTiyin: null, priceUnit: null, photos: [], year: null, condition: null,
  model: null, qty: 1, wagonType: null, capacityT: null, truckType: null, tonnage: null, fleetSize: null, serviceRegions: [], routes: [],
  contactPhone: null,
};

/** PATCH: faqat kelgan maydonlar (null = tozalash, undefined = tegilmaydi). */
export const listingPatch = (dto: UpdateListingDto): Partial<ListingInput> =>
  Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) as Partial<ListingInput>;

export const toListingInput = (dto: ListingBodyDto): ListingInput => ({ ...EMPTY, ...listingPatch(dto) } as ListingInput);
