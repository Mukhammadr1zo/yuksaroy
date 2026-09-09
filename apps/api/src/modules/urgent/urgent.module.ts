import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { UrgentController } from './urgent.controller';

/** Shoshilinch so'rovlar: JwtGuard IdentityModule dan; Prisma va Audit global. */
@Module({
  imports: [IdentityModule],
  controllers: [UrgentController],
})
export class UrgentModule {}
