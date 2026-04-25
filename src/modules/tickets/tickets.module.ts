import { Module } from '@nestjs/common';
import { TicketsController, TicketLookupsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlaModule } from '../sla/sla.module';
import { KafkaModule } from '../kafka/kafka.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [NotificationsModule, SlaModule, KafkaModule, WebsocketModule],
  controllers: [TicketsController, TicketLookupsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
