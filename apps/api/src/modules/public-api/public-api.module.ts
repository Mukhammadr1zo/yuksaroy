import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ListingsModule } from '../listings/listings.module';
import { PublicApiController } from './public-api.controller';

/** Ochiq o'qish API (/v1/public): login yo'q, IP limit, ontologiya. */
@Module({
  imports: [CatalogModule, ListingsModule],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
