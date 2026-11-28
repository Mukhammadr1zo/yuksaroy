import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DRailwayClient } from '../wagon/d-railway.client';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';

/** «Mening vagonlarim»: vagon operatorining parki d-railway spravkasidan. */
@Module({
  imports: [IdentityModule, OrganizationsModule], // JwtGuard; PlatformAdmin (bog'lash)
  controllers: [FleetController],
  // O'z DRailwayClient nusxasi (WagonModule nikini eksport qilmaydi): token alohida saqlanadi, bu zarar qilmaydi
  providers: [FleetService, { provide: DRailwayClient, useFactory: () => new DRailwayClient() }],
})
export class FleetModule {}
