import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { OPERATIONS, SERVICE_CODES, type Operation, type ServiceCode } from '@yuksaroy/domain';
import { QuoteUseCase } from '../application/quote.usecase';

export class QuoteDto {
  @IsOptional() @IsString() terminalId?: string;
  @IsOptional() @IsString() stationId?: string;
  @IsOptional() @Matches(/^\d{5,6}$/) stationEsr?: string;
  @IsIn(OPERATIONS) operation!: Operation;
  @IsOptional() @Matches(/^\d{6}$/) cargoCode?: string;
  @IsInt() @Min(1) @Max(10_000_000) weightKg!: number;
  @IsOptional() @IsInt() @Min(1) @Max(500) wagonCount?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) storageDays?: number;
  @IsOptional() @IsArray() @IsIn(SERVICE_CODES, { each: true }) services?: ServiceCode[];
}

/** Ochiq «tez hisob» - landing va vizard 3-ekrani shu endpointdan. */
@ApiTags('pricing')
@Controller('quote')
export class QuoteController {
  constructor(private readonly quote: QuoteUseCase) {}

  @Post() @HttpCode(200)
  calc(@Body() dto: QuoteDto) {
    return this.quote.execute(dto);
  }
}
