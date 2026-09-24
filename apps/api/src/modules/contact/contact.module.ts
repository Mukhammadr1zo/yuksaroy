import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';

// Prisma va Audit CommonModule dan keladi (u @Global): IdentityModule va
// OrganizationsModule faqat o'chirilgan admin ro'yxati yo'lining qorovullari uchun edi.
@Module({ controllers: [ContactController] })
export class ContactModule {}
