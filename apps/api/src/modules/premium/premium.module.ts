import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PremiumController } from './premium.controller';

@Module({
  imports: [IdentityModule, OrganizationsModule], // PlatformAdmin: navbatni ko'rish, tasdiqlash va bekor qilish
  controllers: [PremiumController],
})
export class PremiumModule {}
