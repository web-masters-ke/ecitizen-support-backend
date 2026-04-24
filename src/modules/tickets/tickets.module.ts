import { Module } from '@nestjs/common';
import { TicketsController, TicketLookupsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlaModule } from '../sla/sla.module';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [NotificationsModule, SlaModule, KafkaModule],
  controllers: [TicketsController, TicketLookupsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
