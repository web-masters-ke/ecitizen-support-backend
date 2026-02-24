import { Module } from '@nestjs/common';
import { TicketsController, TicketLookupsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  controllers: [TicketsController, TicketLookupsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
