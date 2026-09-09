import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { IdentityModule } from '../identity/identity.module';
import { PdfService } from './infrastructure/pdf.service';
import { DocumentsController } from './presentation/documents.controller';

@Module({
  imports: [IdentityModule, OrdersModule],
  controllers: [DocumentsController],
  providers: [PdfService],
})
export class DocumentsModule {}
