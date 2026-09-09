import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PrismaListingRepository } from './infrastructure/prisma-listing.repository';
import { ListingAccess } from './application/listing-access';
import { ListingsUseCase } from './application/listings.usecase';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ListingsOwnerController } from './presentation/listings-owner.controller';
import { AdminListingsController } from './presentation/admin-listings.controller';
import { UploadsController } from './presentation/uploads.controller';
import { ListingsController } from './presentation/listings.controller';

@Module({
  imports: [IdentityModule, OrganizationsModule],
  // Tartib muhim: `listings/mine` statik yo'li `listings/:slug` dan oldin ro'yxatga olinadi.
  controllers: [ListingsOwnerController, AdminListingsController, UploadsController, ListingsController],
  providers: [PrismaListingRepository, ListingAccess, ListingsUseCase],
  exports: [PrismaListingRepository, ListingsUseCase, ListingAccess], // owned(): premium va analitika modullari uchun
})
export class ListingsModule {}
