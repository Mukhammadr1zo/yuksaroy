import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CatalogModule } from '../catalog/catalog.module';
import { BOOKING_REPOSITORY } from './domain/ports';
import { PrismaBookingRepository } from './infrastructure/prisma-booking.repository';
import { ManageSlotsUseCase } from './application/manage-slots.usecase';
import { HoldSlotUseCase } from './application/hold-slot.usecase';
import { SlotsController } from './presentation/slots.controller';

@Module({
  imports: [IdentityModule, CatalogModule],
  controllers: [SlotsController],
  providers: [{ provide: BOOKING_REPOSITORY, useClass: PrismaBookingRepository }, ManageSlotsUseCase, HoldSlotUseCase],
  exports: [BOOKING_REPOSITORY, HoldSlotUseCase],
})
export class BookingModule {}
