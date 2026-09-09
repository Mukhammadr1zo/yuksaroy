import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { QuoteUseCase } from './application/quote.usecase';
import { QuoteController } from './presentation/quote.controller';

@Module({
  imports: [CatalogModule],
  controllers: [QuoteController],
  providers: [QuoteUseCase],
  exports: [QuoteUseCase],
})
export class PricingModule {}
