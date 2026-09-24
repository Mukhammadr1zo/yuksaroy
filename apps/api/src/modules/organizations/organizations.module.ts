import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ORG_REPOSITORY } from './domain/ports';
import { CreateOrgUseCase } from './application/create-org.usecase';
import { AdminNotify } from './application/admin-notify';
import { PlatformAdmin } from './application/platform-admin';
import { PrismaOrganizationRepository } from './infrastructure/prisma-org.repository';
import { OrgsController } from './presentation/orgs.controller';

@Module({
  imports: [IdentityModule],
  controllers: [OrgsController],
  providers: [{ provide: ORG_REPOSITORY, useClass: PrismaOrganizationRepository }, CreateOrgUseCase, PlatformAdmin, AdminNotify],
  exports: [ORG_REPOSITORY, PlatformAdmin, AdminNotify, CreateOrgUseCase],
})
export class OrganizationsModule {}
