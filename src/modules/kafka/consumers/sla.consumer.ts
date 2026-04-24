import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../kafka.service';
import { BaseKafkaConsumer } from '../kafka.consumer.base';
import { KAFKA_TOPICS, KAFKA_TOPICS as T } from '../kafka.topics';

interface SlaBreachEvent {
  ticketId: string;
  ticketNumber: string;
  agencyId: string;
  breachType: 'RESPONSE' | 'RESOLUTION';
  breachDurationMinutes: number;
  assigneeId?: string;
  createdBy: string;
}

@Injectable()
export class SlaConsumer extends BaseKafkaConsumer implements OnModuleInit {
  protected readonly logger = new Logger(SlaConsumer.name);
  protected readonly groupId = 'ecitizen-sla-consumer';
  protected readonly topics = [KAFKA_TOPICS.SLA_BREACHED];

  constructor(
    private readonly kafkaService: KafkaService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.startConsuming(this.kafkaService.getKafkaInstance());
  }

  protected async handleMessage(_topic: string, data: SlaBreachEvent): Promise<void> {
    this.logger.warn(
      `SLA ${data.breachType} breach on ticket ${data.ticketNumber} — ${data.breachDurationMinutes}min overdue`,
    );

    // Publish a notification event for the SLA breach so the notifications consumer handles it
    const recipientUserIds = [data.createdBy, ...(data.assigneeId ? [data.assigneeId] : [])];
    await this.kafkaService.publish({
      topic: T.NOTIFICATIONS_DISPATCH,
      key: data.ticketId,
      value: {
        recipientUserIds,
        channel: 'IN_APP',
        subject: `SLA Breach — Ticket ${data.ticketNumber}`,
        body: `Ticket ${data.ticketNumber} has breached its ${data.breachType.toLowerCase()} SLA by ${data.breachDurationMinutes} minutes.`,
        ticketId: data.ticketId,
        agencyId: data.agencyId,
      },
    });
  }
}
