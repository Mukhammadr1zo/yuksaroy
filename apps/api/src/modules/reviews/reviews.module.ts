import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrdersModule } from '../orders/orders.module';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [IdentityModule, OrdersModule], // OrdersModule: ORDER_REPOSITORY (buyurtma raqami) va OrderAccess (yuk egasi / terminal xodimi)
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
