import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SubscriptionController, SubscriptionPublicController } from './subscription.controller';
import { ContactsController } from './contacts.controller';
import { PlansAdminController, PlansPublicController } from './plans.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [IdentityModule, OrganizationsModule], // JwtGuard; PlatformAdmin (tasdiqlash)
  controllers: [SubscriptionPublicController, SubscriptionController, ContactsController, PlansPublicController, PlansAdminController],
  providers: [SubscriptionService],
  // Telefon va vagon qidiruvi boshqa modullarda: guard va xizmat shularga eksport qilinadi
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
