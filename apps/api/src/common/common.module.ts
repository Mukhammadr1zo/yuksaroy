import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { PlatformConfigService } from './platform-config.service';
import { IdempotencyService } from './idempotency.service';
// Ko'rishlar soni katalogga ham, kabinetga ham kerak; o'z moduli ListingsModule ni import
// qilgani uchun teskari yo'nalish halqa yasardi, shuning uchun xizmat global modulda.
import { ImpressionsService } from '../modules/impressions/impressions.service';
// Superadminlarga faoliyat xabari: AuditService unga tayanadi, shuning uchun global modulda
import { ActivityService } from '../modules/activity/activity.service';

@Global()
@Module({
  providers: [PrismaService, AuditService, PlatformConfigService, IdempotencyService, ImpressionsService, ActivityService],
  exports: [PrismaService, AuditService, PlatformConfigService, IdempotencyService, ImpressionsService, ActivityService],
})
export class CommonModule {}
