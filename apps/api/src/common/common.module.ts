import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { PlatformConfigService } from './platform-config.service';
import { IdempotencyService } from './idempotency.service';

@Global()
@Module({
  providers: [PrismaService, AuditService, PlatformConfigService, IdempotencyService],
  exports: [PrismaService, AuditService, PlatformConfigService, IdempotencyService],
})
export class CommonModule {}
