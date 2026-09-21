import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { DRailwayClient } from './d-railway.client';
import { WagonController } from './wagon.controller';

/** Vagon qidiruvi: d-railway.uz API orqali, birinchisi bepul, keyin obuna. */
@Module({
  imports: [IdentityModule, OrganizationsModule, SubscriptionModule], // JwtGuard; PlatformAdmin; SubscriberGuard
  controllers: [WagonController],
  providers: [DRailwayClient],
})
export class WagonModule {}
