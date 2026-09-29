import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';
import { AdminUsersController } from './admin-users.controller';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminHomeController } from './admin-home.controller';
import { AdminNotesController } from './admin-notes.controller';
import { AdminOrgsController } from './admin-orgs.controller';
import { AdminOpsController } from './admin-ops.controller';
import { AdminSearchController } from './admin-search.controller';
import { AdminSystemController } from './admin-system.controller';
import { AdminDemoController } from './admin-demo.controller';
import { AdminTeamController } from './team/admin-team.controller';

/**
 * Platforma egasi uchun panel. Ilgari bu yerda faqat foydalanuvchilar bor edi va
 * qolgan admin amallari o'z modullariga sochilgan edi. Endi katalog, tashkilot,
 * buyurtma va tizim bo'limlari shu yerda: bitta joyda kim nimaga qodirligi ko'rinadi.
 *
 * Huquq PlatformAdminGuard orqali, har kontrollerning sinf darajasida beriladi.
 */
@Module({
  // BookingModule: admin buyurtmani majburan bekor qilganda band qilingan joy bo'shatiladi
  imports: [IdentityModule, OrganizationsModule, BookingModule],
  // Home (bosh sahifa), Search (Ctrl+K paleti) va Notes (ichki izohlar): panel 3.0 qatlamlari
  controllers: [
    AdminUsersController, AdminCatalogController, AdminOrgsController, AdminOpsController, AdminSystemController,
    AdminHomeController, AdminSearchController, AdminNotesController, AdminDemoController, AdminTeamController,
  ],
  providers: [PlatformAdminGuard, PlatformOwnerGuard],
})
export class AdminModule {}
