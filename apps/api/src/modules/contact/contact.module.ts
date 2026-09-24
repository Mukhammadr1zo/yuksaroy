import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ContactController } from './contact.controller';
import { ReportsController } from './reports.controller';

// Prisma va Audit CommonModule dan keladi (u @Global).
// IdentityModule: shikoyat yo'lidagi JwtGuard. OrganizationsModule: AdminNotify.
@Module({
  imports: [IdentityModule, OrganizationsModule],
  controllers: [ContactController, ReportsController],
})
export class ContactModule {}
