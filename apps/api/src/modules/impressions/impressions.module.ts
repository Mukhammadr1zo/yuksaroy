import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ListingsModule } from '../listings/listings.module';
import { OrdersModule } from '../orders/orders.module';
import { ImpressionsController } from './impressions.controller';

@Module({
  imports: [IdentityModule, ListingsModule, OrdersModule], // ListingsUseCase.owned va OrderAccess.assertTerminalOf: egalik tekshiruvi
  controllers: [ImpressionsController],
  // ImpressionsService CommonModule (global) da: katalog ham foydalanadi
})
export class ImpressionsModule {}
