import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ListingReviewsController } from './listing-reviews.controller';
import { ListingReviewsService } from './listing-reviews.service';

@Module({
  imports: [IdentityModule],
  controllers: [ChatController, ListingReviewsController],
  providers: [ChatService, ListingReviewsService],
})
export class ChatModule {}
