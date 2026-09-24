import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { HelpController } from './help.controller';
import { HelpLlm } from './help.llm';

/** Yordam chati: tez-tez so'raladigan savollar, keyin LLM. */
@Module({
  imports: [IdentityModule, OrganizationsModule, SubscriptionModule], // JwtGuard; PlatformAdmin; obuna tekshiruvi usul ichida
  controllers: [HelpController],
  providers: [{ provide: HelpLlm, useFactory: () => new HelpLlm() }], // env dan kalit va model
})
export class HelpModule {}
