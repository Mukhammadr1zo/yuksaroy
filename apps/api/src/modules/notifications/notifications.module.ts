import { Global, Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Global: xabar yuboradigan modullar (listings, orders, catalog) uni import qilmasdan ishlatadi.
@Global()
@Module({
  imports: [IdentityModule], // JwtGuard: TokenService va sessiya do'koni
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
