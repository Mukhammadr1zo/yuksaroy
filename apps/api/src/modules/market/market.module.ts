import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AdminMarketController } from './admin-market.controller';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { ServicesController } from './services.controller';

/** Xizmatlar markazi va yuk bozori: so'rov -> takliflar -> tanlash. NotificationsModule global. */
@Module({
  imports: [IdentityModule, OrganizationsModule, SubscriptionModule], // JwtGuard; PlatformAdmin; obuna tekshiruvi usul ichida
  controllers: [ServicesController, MarketController, AdminMarketController],
  providers: [MarketService],
})
export class MarketModule {}
