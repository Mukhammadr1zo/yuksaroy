import { Module } from '@nestjs/common';
import { AdsAdminController, AdsPublicController } from './ads.controller';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SubscriptionModule } from '../subscription/subscription.module';

/** Yon tomondagi reklama. Obunachiga ko'rsatilmasligi uchun obuna xizmati kerak. */
@Module({
  imports: [IdentityModule, OrganizationsModule, SubscriptionModule],
  controllers: [AdsPublicController, AdsAdminController],
})
export class AdsModule {}
