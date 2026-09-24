import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { WatchController } from './watch.controller';

// IdentityModule: JwtGuard uchun token xizmati va sessiya do'koni.
// Xizmat yo'q: xabar yuborish erkin funksiya (watchers.ts), uni chaqiruvchi modullar
// import qilmasdan ishlatadi.
@Module({ imports: [IdentityModule], controllers: [WatchController] })
export class WatchModule {}
