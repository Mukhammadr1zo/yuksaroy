import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AdminTask, Prisma } from '@prisma/client';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { uzLocalDate } from '@yuksaroy/domain';
import { QUEUE_LABEL, TASK_ENTITIES, queueOf, type QueueKey, type TaskEntity } from '../../common/admin-queues';
import { DUE_DAYS, DUE_LINE, closeStaleTasks, dueAtOf, inQueue, taskHref, taskTitles, type TaskTitle } from '../../common/admin-tasks';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { notifyBoth } from '../../common/telegram';
import { clampInt } from '../catalog/presentation/catalog.controller';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformAdmin } from '../organizations/application/platform-admin';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';

class CreateTaskDto {
  @IsIn(TASK_ENTITIES) entity!: TaskEntity;
  @IsString() @Length(1, 200) entityId!: string;
  @IsString() @Length(1, 200) assigneeId!: string;
  /** 0 = bugun 23:59; berilmasa muddatsiz */
  @IsOptional() @IsIn(DUE_DAYS) dueDays?: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

type Person = { id: string; fullName: string | null; phone: string | null };
type Task = {
  id: string; entity: TaskEntity; entityId: string; queue: QueueKey; title: string | null; href: string; note: string | null;
  dueAt: Date | null; doneAt: Date | null; doneReason: 'queue' | 'manual' | null; assignedAt: Date; assignee: Person | null; assignedBy: Person | null;
};

/**
 * Jamoa vazifalari: navbatdagi ish kimga biriktirilgan. Operator ham biriktiradi (bu kundalik ish).
 * Qaytariladigan amallar: ikki bosqich yo'q, har biri auditga (entity/entityId obyektniki, Tarix yorlig'ida ko'rinsin).
 */
@ApiTags('admin')
@ApiCookieAuth('ys_access')
@Controller('admin/tasks')
@UseGuards(JwtGuard, PlatformAdminGuard)
export class AdminTasksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly admin: PlatformAdmin,
    private readonly notifications: NotificationsService,
  ) {}

  /** Ro'yxat: muddati o'tgan tepada, keyin eng uzoq kutgan. Avval navbatdan chiqqan ishlar yopiladi. */
  @Get()
  async list(
    @CurrentUserId() me: string,
    @Query('assignee') assignee?: string,
    @Query('open') open?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const now = new Date();
    await closeStaleTasks(this.prisma, now);
    const where: Prisma.AdminTaskWhereInput = {
      ...(assignee ? { assigneeId: assignee === 'me' ? me : assignee } : {}),
      ...(open === '1' ? { doneAt: null } : {}),
      ...(entity ? { entity } : {}),
      ...(entityId ? { entityId } : {}),
    };
    const p = clampInt(page, 1, 1, 100_000);
    const take = clampInt(limit, 30, 1, 500);
    const [total, rows, openCount, overdue] = await Promise.all([
      this.prisma.adminTask.count({ where }),
      this.prisma.adminTask.findMany({ where, orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { assignedAt: 'asc' }, { id: 'asc' }], skip: (p - 1) * take, take }),
      this.prisma.adminTask.count({ where: { ...where, doneAt: null } }),
      this.prisma.adminTask.count({ where: { ...where, doneAt: null, dueAt: { lt: now } } }),
    ]);
    return { items: await this.hydrate(rows), total, page: p, limit: take, summary: { open: openCount, overdue } };
  }

  /** Kimga biriktirish mumkin: faol panel xodimlari. Operator ham ko'radi (GET /admin/team egaga xos). */
  @Get('assignees')
  async assignees() {
    const ids = await this.admin.adminUserIds();
    const items = await this.prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, fullName: true, phone: true },
      orderBy: { fullName: { sort: 'asc', nulls: 'last' } },
    });
    return { items };
  }

  /**
   * Biriktirish yoki qayta biriktirish: bir obyektga bitta qator (unique), upsert.
   * Poyga bazada yopiladi. Yopiq qator qayta ochiladi (e'lon navbatga qaytgan bo'lsa), bu ataylab.
   */
  @Post() @HttpCode(201)
  async create(@CurrentUserId() me: string, @Body() dto: CreateTaskDto) {
    const now = new Date();
    // Bloklangan xodim (isActive=false) assignees ro'yxatida yo'q, shuning uchun bu yerda ham o'tmasin:
    // aks holda unga qo'ng'iroq va Telegram ketadi, vazifa esa hech qachon bajarilmaydi
    const ok = (await this.admin.adminUserIds()).includes(dto.assigneeId)
      && !!(await this.prisma.user.findFirst({ where: { id: dto.assigneeId, isActive: true }, select: { id: true } }));
    if (!ok) throw new BadRequestException({ code: 'BAD_ASSIGNEE' });
    // Obyekt yo'q bo'lsa ham shu: navbatda bo'lmagan ishga vazifa ochilmaydi
    if (!(await inQueue(this.prisma, dto.entity, [dto.entityId])).has(dto.entityId)) throw new ConflictException({ code: 'NOT_IN_QUEUE' });
    const note = dto.note?.trim() || null;
    const dueAt = dueAtOf(now, dto.dueDays ?? null);
    const key = { entity: dto.entity, entityId: dto.entityId };
    const prev = await this.prisma.adminTask.findUnique({ where: { entity_entityId: key } });
    const row = await this.prisma.adminTask.upsert({
      where: { entity_entityId: key },
      create: { ...key, assigneeId: dto.assigneeId, assignedById: me, note, dueAt, assignedAt: now },
      update: { assigneeId: dto.assigneeId, assignedById: me, note, dueAt, doneAt: null, doneReason: null, assignedAt: now },
    });
    await this.audit.log({
      actorId: me, action: 'admin.task.assign', entity: dto.entity, entityId: dto.entityId,
      meta: { taskId: row.id, assigneeId: dto.assigneeId, dueAt, note, reassignedFrom: prev && !prev.doneAt ? prev.assigneeId : null },
    });
    const [task] = await this.hydrate([row]);
    // O'ziga olganda xabar yo'q; jamoadoshga kabinet qo'ng'irog'i va Telegram (bog'langan bo'lsa)
    if (dto.assigneeId !== me) {
      await notifyBoth(this.prisma, this.notifications, {
        target: { userIds: [dto.assigneeId] }, kind: 'adminTask', inApp: 'claim', href: task.href,
        vars: (l) => ({
          what: `${QUEUE_LABEL[l][task.queue]}: ${task.title ?? dto.entityId}`,
          by: task.assignedBy?.fullName || task.assignedBy?.phone || '',
          due: dueAt ? `${DUE_LINE[l].at}${uzLocalDate(dueAt)}` : DUE_LINE[l].none,
        }),
      }).catch(() => {});
    }
    return task;
  }

  /** Bajarildi: biriktirilgan, biriktirgan yoki ega yopadi. Biriktirishni bekor qilish ham shu (DELETE yo'q). */
  @Post(':id/done') @HttpCode(200)
  async done(@CurrentUserId() me: string, @Param('id') id: string) {
    const t = await this.prisma.adminTask.findUnique({ where: { id } });
    if (!t) throw new NotFoundException({ code: 'TASK_NOT_FOUND' });
    if (t.doneAt) throw new ConflictException({ code: 'TASK_DONE' });
    if (t.assigneeId !== me && t.assignedById !== me && !(await this.admin.isPlatformOwner(me))) throw new ForbiddenException({ code: 'TASK_FORBIDDEN' });
    const now = new Date();
    // Poyga: 30 s sweeper (queue) yoki boshqa admin shu orada yopgan bo'lsa count=0, soxta audit va 200 yozilmasin
    const r = await this.prisma.adminTask.updateMany({ where: { id, doneAt: null }, data: { doneAt: now, doneReason: 'manual' } });
    if (!r.count) throw new ConflictException({ code: 'TASK_DONE' });
    await this.audit.log({ actorId: me, action: 'admin.task.done', entity: t.entity, entityId: t.entityId, meta: { taskId: id, assigneeId: t.assigneeId } });
    return { id, doneAt: now.toISOString() };
  }

  /** Ismlar (FK yo'q), sarlavha va havola (tur bo'yicha guruhlab, 9 tagacha so'rov), navbat kaliti. */
  private async hydrate(rows: AdminTask[]): Promise<Task[]> {
    if (!rows.length) return [];
    const ids = [...new Set(rows.flatMap((r) => [r.assigneeId, r.assignedById]))];
    const byEntity = new Map<TaskEntity, string[]>();
    for (const r of rows) {
      const e = r.entity as TaskEntity;
      byEntity.set(e, [...(byEntity.get(e) ?? []), r.entityId]);
    }
    const titles = new Map<string, TaskTitle>();
    const [users] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, phone: true } }),
      ...[...byEntity].map(async ([e, eids]) => {
        for (const [id, t] of await taskTitles(this.prisma, e, eids)) titles.set(`${e}:${id}`, t);
      }),
    ]);
    const people = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => {
      const e = r.entity as TaskEntity;
      const t = titles.get(`${e}:${r.entityId}`);
      return {
        id: r.id, entity: e, entityId: r.entityId, queue: queueOf(e), title: t?.title ?? null, href: taskHref(e, r.entityId, t?.no),
        note: r.note, dueAt: r.dueAt, doneAt: r.doneAt, doneReason: r.doneReason as Task['doneReason'], assignedAt: r.assignedAt,
        assignee: people.get(r.assigneeId) ?? null, assignedBy: people.get(r.assignedById) ?? null,
      };
    });
  }
}
