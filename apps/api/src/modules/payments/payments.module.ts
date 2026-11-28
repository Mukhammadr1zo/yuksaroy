import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PaymentsController } from './payments.controller';
import { PrismaPaymentStore } from './store';

/** Online to'lov: Payme va Click serverlarining so'rovlari, to'lov kelganda obuna o'zi yoqiladi. */
@Module({
  imports: [SubscriptionModule],
  controllers: [PaymentsController],
  providers: [PrismaPaymentStore],
})
export class PaymentsModule {}
