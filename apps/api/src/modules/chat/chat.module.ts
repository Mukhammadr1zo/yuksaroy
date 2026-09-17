import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ChatController, TerminalInquiryController } from './chat.controller';
import { ChatService } from './chat.service';
import { ListingReviewsController } from './listing-reviews.controller';
import { ListingReviewsService } from './listing-reviews.service';

@Module({
  imports: [IdentityModule, OrganizationsModule], // NotificationsModule global
  controllers: [ChatController, TerminalInquiryController, ListingReviewsController],
  providers: [ChatService, ListingReviewsService],
})
export class ChatModule {}
