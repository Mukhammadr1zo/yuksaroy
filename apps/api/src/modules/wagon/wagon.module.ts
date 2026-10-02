import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { DRailwayClient } from './d-railway.client';
import { WagonController } from './wagon.controller';

/** Vagon qidiruvi: d-railway.uz API orqali, birinchisi bepul, keyin obuna. */
@Module({
  imports: [IdentityModule, OrganizationsModule, SubscriptionModule], // JwtGuard; PlatformAdmin; obuna tekshiruvi usul ichida
  // ImpressionsService (to'lov devorining sanog'i) bu yerda yo'q va kerak ham emas:
  // u global CommonModule da turadi. Qidirgan odam shu izohni o'qib to'xtasin.
  controllers: [WagonController],
  // useFactory: konstruktor parametrlari (sozlama obyekti, fetch) Nest uchun token emas, oddiy class provider ishga tushmaydi
  providers: [{ provide: DRailwayClient, useFactory: () => new DRailwayClient() }], // env dan manzil, login, parol
})
export class WagonModule {}
