import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ListingsModule } from '../listings/listings.module';
import { CATALOG_REPOSITORY } from './domain/ports';
import { PrismaCatalogRepository } from './infrastructure/prisma-catalog.repository';
import { TerminalAccess } from './application/terminal-access';
import { UpsertTerminalUseCase } from './application/upsert-terminal.usecase';
import { PublishTariffUseCase } from './application/publish-tariff.usecase';
import { ClaimTerminalUseCase } from './application/claim-terminal.usecase';
import { TerminalAdminController } from './presentation/terminal-admin.controller';
import { CatalogController } from './presentation/catalog.controller';
import { CompaniesController } from './presentation/companies.controller';

@Module({
  imports: [IdentityModule, OrganizationsModule, ListingsModule], // ListingsModule: xarita GeoJSON e'lon nuqtalari uchun
  // Tartib muhim: `terminals/mine` statik yo'li `:slug` dan oldin ro'yxatga olinadi.
  controllers: [TerminalAdminController, CatalogController, CompaniesController],
  providers: [{ provide: CATALOG_REPOSITORY, useClass: PrismaCatalogRepository }, TerminalAccess, UpsertTerminalUseCase, PublishTariffUseCase, ClaimTerminalUseCase],
  exports: [CATALOG_REPOSITORY, TerminalAccess, UpsertTerminalUseCase],
})
export class CatalogModule {}
