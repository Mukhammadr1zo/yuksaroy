import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { CatalogModule } from '../catalog/catalog.module';
import { BookingModule } from '../booking/booking.module';
import { DocumentsIssueModule } from '../documents/issue.module';
import { ORDER_REPOSITORY } from './domain/ports';
import { PrismaOrderRepository } from './infrastructure/prisma-order.repository';
import { OrderAccess } from './application/order-access';
import { CreateOrderUseCase } from './application/create-order.usecase';
import { OrderActionsUseCase } from './application/order-actions.usecase';
import { ListOrdersUseCase } from './application/list-orders.usecase';
import { SlaSweeperService } from './application/sla-sweeper.service';
import { OrdersController } from './presentation/orders.controller';

@Module({
  imports: [IdentityModule, OrganizationsModule, CatalogModule, BookingModule, DocumentsIssueModule],
  controllers: [OrdersController],
  providers: [
    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
    OrderAccess, CreateOrderUseCase, OrderActionsUseCase, ListOrdersUseCase, SlaSweeperService,
  ],
  exports: [ORDER_REPOSITORY, SlaSweeperService, ListOrdersUseCase, OrderAccess],
})
export class OrdersModule {}
