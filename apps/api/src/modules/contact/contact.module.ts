import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ContactController } from './contact.controller';

@Module({
  imports: [IdentityModule, OrganizationsModule], // JwtGuard va PlatformAdmin (admin ro'yxati)
  controllers: [ContactController],
})
export class ContactModule {}
