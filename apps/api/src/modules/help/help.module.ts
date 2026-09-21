import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SubscriptionModule } from '../subscription/subscription.module';

/** Yordam chati: tez-tez so'raladigan savollar, keyin LLM. */
@Module({
  imports: [IdentityModule, OrganizationsModule, SubscriptionModule], // JwtGuard; PlatformAdmin; SubscriberGuard
  controllers: [],
  providers: [],
})
export class HelpModule {}
