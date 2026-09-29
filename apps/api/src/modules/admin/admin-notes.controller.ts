import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { clampInt, pickIn } from '../catalog/presentation/catalog.controller';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';

/** Izoh yozsa bo'ladigan obyektlar: obyekt sahifasi bor to'rt tur. */
export const NOTE_ENTITIES = ['Organization', 'Terminal', 'Listing', 'User'] as const;
export type NoteEntity = (typeof NOTE_ENTITIES)[number];

class NoteCreateDto {
  @IsIn(NOTE_ENTITIES) entity!: NoteEntity;
  @IsString() @Length(1, 200) entityId!: string;
  @IsString() @Length(1, 2000) text!: string;
}

/** Obyekt mavjudligi: har tur o'z jadvalida. count: yo'q qator uchun findUnique ham bo'lardi, lekin select kerak emas. */
const exists = (prisma: PrismaService, entity: NoteEntity, id: string): Promise<number> => {
  switch (entity) {
    case 'Organization': return prisma.organization.count({ where: { id } });
    case 'Terminal': return prisma.terminal.count({ where: { id } });
    case 'Listing': return prisma.listing.count({ where: { id } });
    case 'User': return prisma.user.count({ where: { id } });
  }
};

/**
 * Obyekt tafsilotidagi izohlar soni (yorliqdagi son: kimdir bu obyekt bilan ishlaganmi).
 * Jadval hali yo'q bo'lsa (migratsiya koddan keyin) 0: tafsilot butunlay yiqilmasin.
 */
export const noteCount = (prisma: PrismaService, entity: NoteEntity, entityId: string): Promise<number> =>
  prisma.adminNote.count({ where: { entity, entityId } }).catch(() => 0);

/**
 * Jamoaning ichki izohlari: qo'ng'iroq natijasi, kelishuv, shubha. Obyekt egasiga hech
 * qayerda ko'rinmaydi (ommaviy mapperlarga kirmaydi, faqat shu yo'l). Yozish operatorga
 * ham ochiq, o'chirish faqat egada va matn jurnalda qoladi: izoh o'chirilgani bilan
 * "kim nima yozgan edi" savoli javobsiz qolmaydi.
 */
@ApiTags('admin')
@Controller('admin/notes')
@UseGuards(JwtGuard, PlatformAdminGuard)
@ApiCookieAuth('ys_access')
export class AdminNotesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Yangisi yuqorida. Mualliflar alohida so'rov bilan: AdminNote da User ga relation yo'q (audit ro'yxatidagidek). */
  @Get()
  async list(@Query('entity') entity?: string, @Query('entityId') entityId?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const ent = pickIn(entity, NOTE_ENTITIES);
    if (!ent || !entityId) throw new BadRequestException({ code: 'BAD_ENTITY' });
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(limit, 30, 1, 100);
    const where = { entity: ent, entityId };
    const [total, rows] = await Promise.all([
      this.prisma.adminNote.count({ where }),
      this.prisma.adminNote.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (p - 1) * take, take }),
    ]);
    const ids = [...new Set(rows.map((r) => r.authorId))];
    const users = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, phone: true } })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      items: rows.map(({ authorId, ...r }) => ({ ...r, author: byId.get(authorId) ?? null })),
      total, page: p, limit: take,
    };
  }

  /** Obyekt tekshiriladi: yetim izoh yaratilmaydi (obyekt keyin o'chsa izoh qoladi, bu ataylab). */
  @Post()
  async create(@CurrentUserId() userId: string, @Body() dto: NoteCreateDto) {
    const entity = pickIn(dto.entity, NOTE_ENTITIES);
    if (!entity) throw new BadRequestException({ code: 'BAD_ENTITY' });
    const text = dto.text.trim();
    // Bo'sh yoki faqat bo'shliq: class-validator uzunlikni o'lchaydi, mazmunni emas
    if (!text) throw new BadRequestException({ code: 'TEXT_REQUIRED' });
    if (!(await exists(this.prisma, entity, dto.entityId))) throw new NotFoundException({ code: 'OBJECT_NOT_FOUND' });
    const note = await this.prisma.adminNote.create({ data: { entity, entityId: dto.entityId, authorId: userId, text } });
    const author = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true, phone: true } });
    // entity/entityId obyektniki: obyekt tarixida "izoh yozildi" ko'rinsin
    await this.audit.log({ actorId: userId, action: 'admin.note.create', entity, entityId: dto.entityId, meta: { noteId: note.id, len: text.length } });
    const { authorId: _a, ...rest } = note;
    return { ...rest, author: author ?? { id: userId, fullName: null, phone: null } };
  }

  /** Qattiq o'chirish, matn jurnalda qoladi. */
  // Faqat ega: operator o'z izini o'chira olmasin
  @Delete(':id')
  @UseGuards(PlatformOwnerGuard)
  async remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    const note = await this.prisma.adminNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException({ code: 'NOTE_NOT_FOUND' });
    await this.prisma.adminNote.delete({ where: { id } });
    await this.audit.log({ actorId: userId, action: 'admin.note.delete', entity: note.entity, entityId: note.entityId, meta: { noteId: id, authorId: note.authorId, text: note.text } });
    return { id, deleted: true };
  }
}
