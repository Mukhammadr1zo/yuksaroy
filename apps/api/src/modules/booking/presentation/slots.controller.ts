import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { CurrentUserId, JwtGuard } from '../../identity/presentation/jwt.guard';
import { AuditService } from '../../../common/audit.service';
import { ManageSlotsUseCase } from '../application/manage-slots.usecase';
import { HoldSlotUseCase } from '../application/hold-slot.usecase';

class SlotWindowDto {
  @IsInt() @Min(1) @Max(24) window!: number;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) start!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) end!: string;
  @IsInt() @Min(0) @Max(100) capacity!: number;
}
class OpenCapacityDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SlotWindowDto) windows?: SlotWindowDto[];
  @IsOptional() @IsBoolean() weekdaysOnly?: boolean;
}
class CloseSlotDto {
  @IsBoolean() closed!: boolean;
}
class HoldDto {
  @IsOptional() @IsString() orgId?: string;
}

/** Slot kalendari: ochiq ko'rish + terminal boshqaruvi + mijoz hold'i. */
@ApiTags('booking')
@Controller()
export class SlotsController {
  constructor(private readonly slots: ManageSlotsUseCase, private readonly holds: HoldSlotUseCase, private readonly audit: AuditService) {}

  /** Ochiq: terminalning bo'sh slotlari (default bugundan 14 kun). */
  @Get('terminals/:id/slots')
  list(@Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.slots.listSlots(id, from, to);
  }

  @Put('terminals/:id/capacity') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async capacity(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: OpenCapacityDto) {
    const r = await this.slots.openCapacity(userId, id, dto);
    await this.audit.log({ actorId: userId, action: 'slots.capacity', entity: 'Terminal', entityId: id, meta: { ...dto, ...r } });
    return r;
  }

  @Post('terminals/:id/slots/:slotId/close') @HttpCode(200) @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  close(@CurrentUserId() userId: string, @Param('id') id: string, @Param('slotId') slotId: string, @Body() dto: CloseSlotDto) {
    return this.slots.setSlotClosed(userId, id, slotId, dto.closed);
  }

  @Post('slots/:id/hold') @HttpCode(201) @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  hold(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: HoldDto) {
    return this.holds.hold(userId, id, dto?.orgId ?? null);
  }

  @Delete('holds/:id') @HttpCode(204) @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  release(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.holds.release(userId, id);
  }

  @Post('holds/:id/extend') @HttpCode(200) @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  extend(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.holds.extend(userId, id);
  }
}
