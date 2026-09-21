import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SubscriptionModule } from '../subscription/subscription.module';

/** Vagon qidiruvi: d-railway.uz API orqali, birinchisi bepul, keyin obuna. */
@Module({
  imports: [IdentityModule, OrganizationsModule, SubscriptionModule], // JwtGuard; PlatformAdmin; SubscriberGuard
  controllers: [],
  providers: [],
})
export class WagonModule {}
