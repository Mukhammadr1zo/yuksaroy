import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { PlatformConfigService } from './platform-config.service';
import { IdempotencyService } from './idempotency.service';
// Ko'rishlar soni katalogga ham, kabinetga ham kerak; o'z moduli ListingsModule ni import
// qilgani uchun teskari yo'nalish halqa yasardi, shuning uchun xizmat global modulda.
import { ImpressionsService } from '../modules/impressions/impressions.service';

@Global()
@Module({
  providers: [PrismaService, AuditService, PlatformConfigService, IdempotencyService, ImpressionsService],
  exports: [PrismaService, AuditService, PlatformConfigService, IdempotencyService, ImpressionsService],
})
export class CommonModule {}
