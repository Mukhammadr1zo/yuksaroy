import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { IdentityModule } from '../identity/identity.module';
import { SearchController } from './search.controller';
import { Yordamchi } from './yordamchi';

/** Bugungi bo'sh slotlar katalog repozitoriyasida hisoblanadi, shuning uchun BookingModule kerak emas. IdentityModule: ixtiyoriy kirish (kunlik limit kaliti). */
@Module({
  imports: [CatalogModule, IdentityModule],
  controllers: [SearchController],
  providers: [{ provide: Yordamchi, useFactory: () => new Yordamchi() }], // env dan kalit va model
})
export class SearchModule {}
