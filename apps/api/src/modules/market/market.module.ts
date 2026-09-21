import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SubscriptionModule } from '../subscription/subscription.module';

/** Xizmatlar markazi va yuk bozori: so'rov -> takliflar -> tanlash. */
@Module({
  imports: [IdentityModule, OrganizationsModule, SubscriptionModule], // JwtGuard; PlatformAdmin; SubscriberGuard
  controllers: [],
  providers: [],
})
export class MarketModule {}
