import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma.service';
import { JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';

export type SearchHit = { kind: 'org' | 'terminal' | 'user' | 'listing'; id: string; title: string; sub: string | null; status: string };

/** Har turdan shuncha: paleta ro'yxati bitta ekranga sig'sin, aniqroq so'rov qolganini topadi. */
const TAKE = 5;
const like = (text: string) => ({ contains: text, mode: 'insensitive' as const });

/**
 * Buyruq paleti (Ctrl+K) erkin matni: tashkilot, terminal, foydalanuvchi va e'lon bir
 * so'rovda. Raqam prefikslari (PAY-, SR-, YS-, UR-, telefon) mijozda hal bo'ladi va bu
 * yerga kelmaydi; manzil ham mijozda kind bo'yicha (API panel yo'llarini bilmaydi).
 */
@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtGuard, PlatformAdminGuard)
@ApiCookieAuth('ys_access')
export class AdminSearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('search')
  async search(@Query('q') q?: string): Promise<{ hits: SearchHit[] }> {
    // Bir belgi butun bazani qaytaradi: ikki belgidan boshlanadi; 80 dan uzuni URL dan yopishtirilgan matn
    const text = (q ?? '').trim().slice(0, 80);
    if (text.length < 2) return { hits: [] };
    const digits = text.replace(/[^\d+]/g, '');
    const [orgs, terminals, users, listings] = await Promise.all([
      this.prisma.organization.findMany({
        where: { OR: [{ name: like(text) }, { slug: like(text) }, { stir: like(text) }] },
        select: { id: true, name: true, slug: true, kycStatus: true }, take: TAKE, orderBy: { name: 'asc' },
      }),
      this.prisma.terminal.findMany({
        where: { OR: [{ name: like(text) }, { slug: like(text) }, { stationNameRaw: like(text) }] },
        select: { id: true, name: true, slug: true, status: true, stationNameRaw: true }, take: TAKE, orderBy: { name: 'asc' },
      }),
      this.prisma.user.findMany({
        // Telefon raqamlar bo'yicha: "90 123" ham topsin (users ro'yxatidagi bilan bir xil usul)
        where: { OR: [{ fullName: like(text) }, { email: like(text) }, ...(digits ? [{ phone: { contains: digits } }] : [])] },
        select: { id: true, fullName: true, phone: true, email: true, isActive: true }, take: TAKE, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.listing.findMany({
        // Faqat ko'rinadigan va navbatdagi e'lon: arxivdagisini paletadan ochish qaror bermaydi
        where: { status: { in: ['ACTIVE', 'PENDING_REVIEW'] }, OR: [{ title: like(text) }, { slug: like(text) }] },
        select: { id: true, title: true, slug: true, status: true }, take: TAKE, orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return {
      hits: [
        ...orgs.map((o): SearchHit => ({ kind: 'org', id: o.id, title: o.name, sub: o.slug, status: o.kycStatus })),
        ...terminals.map((t): SearchHit => ({ kind: 'terminal', id: t.id, title: t.name, sub: t.stationNameRaw ?? t.slug, status: t.status })),
        ...users.map((u): SearchHit => ({ kind: 'user', id: u.id, title: u.fullName ?? u.phone ?? u.email ?? u.id, sub: u.phone ?? u.email, status: u.isActive ? 'ACTIVE' : 'BLOCKED' })),
        ...listings.map((l): SearchHit => ({ kind: 'listing', id: l.id, title: l.title, sub: l.slug, status: l.status })),
      ],
    };
  }
}
