import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, MaxLength, Max, Min } from 'class-validator';
import { DIRECTIONS, ORDER_EVENT_CODES, ORDER_STATUSES, OPERATIONS, SERVICE_CODES, type Direction, type OrderEventCode, type OrderStatus, type Operation, type ServiceCode } from '@yuksaroy/domain';
import { CurrentUserId, JwtGuard } from '../../identity/presentation/jwt.guard';
import { AuditService } from '../../../common/audit.service';
import { IdempotencyService } from '../../../common/idempotency.service';
import { CreateOrderUseCase } from '../application/create-order.usecase';
import { OrderActionsUseCase } from '../application/order-actions.usecase';
import { ListOrdersUseCase } from '../application/list-orders.usecase';
import { publicOrder, orderCard } from './mappers';
import { groupBoard } from '../domain/board';

class CreateOrderDto {
  @IsString() orgId!: string;
  @IsString() bookingId!: string;
  @IsIn(OPERATIONS) operation!: Operation;
  @IsOptional() @IsIn(DIRECTIONS) direction?: Direction;
  @IsOptional() @Matches(/^\d{6}$/) cargoCode?: string;
  @IsInt() @Min(1) @Max(10_000_000) weightKg!: number;
  @IsOptional() @IsInt() @Min(1) @Max(500) wagonCount?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) storageDays?: number;
  @IsOptional() @IsArray() @IsIn(SERVICE_CODES, { each: true }) services?: ServiceCode[];
  @IsOptional() @IsArray() @IsString({ each: true }) @Matches(/^\d{8}$/, { each: true }) wagonNumbers?: string[];
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
class ReasonDto {
  @IsString() @MaxLength(300) reason!: string;
}
class CancelDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
class EventDto {
  @IsIn(ORDER_EVENT_CODES) code!: OrderEventCode;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

/** Buyurtma: mijoz yaratadi va bekor qiladi, terminal tasdiqlaydi va yuritadi (3.1, 6.5). */
@ApiTags('orders')
@ApiCookieAuth('ys_access')
@Controller('orders')
@UseGuards(JwtGuard)
export class OrdersController {
  constructor(
    private readonly create: CreateOrderUseCase,
    private readonly actions: OrderActionsUseCase,
    private readonly listing: ListOrdersUseCase,
    private readonly idem: IdempotencyService,
    private readonly audit: AuditService,
  ) {}

  @Post() @HttpCode(201)
  async createOrder(@CurrentUserId() userId: string, @Body() dto: CreateOrderDto, @Headers('idempotency-key') key?: string) {
    return this.idem.run(key, userId, 'POST /orders', async () => {
      const o = await this.create.execute(userId, dto);
      await this.audit.log({ actorId: userId, action: 'order.create', entity: 'Order', entityId: o.id, meta: { no: o.no, terminalId: o.terminalId, totalTiyin: o.totalTiyin } });
      return publicOrder(o);
    });
  }

  /** scope=client (o'z tashkilotlarim) | terminal (o'z obyektlarim). Default: ikkalasi. */
  @Get()
  async list(
    @CurrentUserId() userId: string,
    @Query('scope') scope?: string, @Query('status') status?: string, @Query('q') q?: string,
    @Query('page') page?: string, @Query('limit') limit?: string,
  ) {
    const statuses = (status ?? '').split(',').map((s) => s.trim()).filter((s): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s));
    const r = await this.listing.list(userId, {
      scope: scope === 'client' || scope === 'terminal' ? scope : 'any',
      status: statuses, q: q?.trim() || undefined,
      page: Math.max(1, Number(page) || 1), limit: Math.min(50, Math.max(1, Number(limit) || 20)),
    });
    return { ...r, items: r.items.map(orderCard) };
  }

  /** Terminal kabineti sarlavhasi: holatlar bo'yicha sanoq. */
  @Get('summary')
  summary(@CurrentUserId() userId: string) {
    return this.listing.terminalSummary(userId);
  }

  /** Kanban taxtasi: ustunlar holat bo'yicha, slot boshlanishi bo'yicha saralangan, har biri 100 tagacha. */
  @Get('board')
  async board(@CurrentUserId() userId: string, @Query('scope') scope?: string) {
    // ponytail: oxirgi 500 buyurtma bitta so'rovda, xotirada guruhlanadi; ustun bo'yicha alohida so'rov 500+ faol buyurtmada
    const r = await this.listing.list(userId, { scope: scope === 'client' || scope === 'terminal' ? scope : 'any', status: [], page: 1, limit: 500 });
    return groupBoard(r.items.map(orderCard));
  }

  @Get(':no')
  async get(@CurrentUserId() userId: string, @Param('no') no: string) {
    return publicOrder(await this.listing.getForUser(userId, no));
  }

  @Post(':no/confirm') @HttpCode(200)
  async confirm(@CurrentUserId() userId: string, @Param('no') no: string) {
    const o = await this.actions.confirm(userId, no);
    await this.audit.log({ actorId: userId, action: 'order.confirm', entity: 'Order', entityId: o.id, meta: { no } });
    return publicOrder(o);
  }

  @Post(':no/reject') @HttpCode(200)
  async reject(@CurrentUserId() userId: string, @Param('no') no: string, @Body() dto: ReasonDto) {
    const o = await this.actions.reject(userId, no, dto.reason);
    await this.audit.log({ actorId: userId, action: 'order.reject', entity: 'Order', entityId: o.id, meta: { no, reason: dto.reason } });
    return publicOrder(o);
  }

  @Post(':no/events') @HttpCode(200)
  async event(@CurrentUserId() userId: string, @Param('no') no: string, @Body() dto: EventDto) {
    return publicOrder(await this.actions.addEvent(userId, no, dto.code, dto.payload));
  }

  @Post(':no/complete') @HttpCode(200)
  async complete(@CurrentUserId() userId: string, @Param('no') no: string) {
    const o = await this.actions.complete(userId, no);
    await this.audit.log({ actorId: userId, action: 'order.complete', entity: 'Order', entityId: o.id, meta: { no } });
    return publicOrder(o);
  }

  @Post(':no/cancel') @HttpCode(200)
  async cancel(@CurrentUserId() userId: string, @Param('no') no: string, @Body() dto: CancelDto) {
    const o = await this.actions.cancel(userId, no, dto?.reason);
    await this.audit.log({ actorId: userId, action: 'order.cancel', entity: 'Order', entityId: o.id, meta: { no } });
    return publicOrder(o);
  }
}
