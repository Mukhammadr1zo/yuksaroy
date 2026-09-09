import { Module } from '@nestjs/common';
import { IssueDocumentsUseCase } from './application/issue-documents.usecase';

/**
 * Hujjat tuzuvchi alohida modul: u faqat Prisma'ga bog'liq.
 * Shu tufayli OrdersModule uni import qila oladi va aylanma bog'liqlik yuzaga kelmaydi
 * (DocumentsModule esa teskari yo'nalishda OrdersModule'ni import qiladi).
 */
@Module({
  providers: [IssueDocumentsUseCase],
  exports: [IssueDocumentsUseCase],
})
export class DocumentsIssueModule {}
