import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ListingsModule } from '../listings/listings.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PremiumController } from './premium.controller';

@Module({
  imports: [IdentityModule, ListingsModule, OrganizationsModule], // ListingsUseCase.owned (egasi), PlatformAdmin (tasdiqlash)
  controllers: [PremiumController],
})
export class PremiumModule {}
