import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SubscriptionController } from './subscription.controller';
import { ContactsController } from './contacts.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriberGuard } from './subscriber.guard';

@Module({
  imports: [IdentityModule, OrganizationsModule], // JwtGuard; PlatformAdmin (tasdiqlash)
  controllers: [SubscriptionController, ContactsController],
  providers: [SubscriptionService, SubscriberGuard],
  // Telefon va vagon qidiruvi boshqa modullarda: guard va xizmat shularga eksport qilinadi
  exports: [SubscriptionService, SubscriberGuard],
})
export class SubscriptionModule {}
