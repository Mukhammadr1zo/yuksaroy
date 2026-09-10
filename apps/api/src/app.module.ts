import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { IdentityModule } from './modules/identity/identity.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { BookingModule } from './modules/booking/booking.module';
import { OrdersModule } from './modules/orders/orders.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SearchModule } from './modules/search/search.module';
import { ListingsModule } from './modules/listings/listings.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ImpressionsModule } from './modules/impressions/impressions.module';
import { PremiumModule } from './modules/premium/premium.module';
import { ContactModule } from './modules/contact/contact.module';
import { UrgentModule } from './modules/urgent/urgent.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    CommonModule, IdentityModule, OrganizationsModule, CatalogModule, PricingModule, BookingModule, OrdersModule, DocumentsModule, SearchModule, ListingsModule,
    ReviewsModule, ImpressionsModule, PremiumModule, ContactModule, // 5-bosqich: baho, ko'rsatishlar, premium, murojaat
    UrgentModule, // 6-bosqich: shoshilinch so'rovlar
  ],
  controllers: [HealthController],
})
export class AppModule {}
