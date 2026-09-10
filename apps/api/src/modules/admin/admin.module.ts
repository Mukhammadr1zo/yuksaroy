import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AdminUsersController } from './admin-users.controller';

// Platforma egasi uchun: foydalanuvchilar va umumiy raqamlar.
@Module({ imports: [IdentityModule, OrganizationsModule], controllers: [AdminUsersController] })
export class AdminModule {}
