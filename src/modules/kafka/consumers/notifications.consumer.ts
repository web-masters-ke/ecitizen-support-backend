import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../kafka.service';
import { BaseKafkaConsumer } from '../kafka.consumer.base';
import { KAFKA_TOPICS } from '../kafka.topics';
import { NotificationsService } from '../../notifications/notifications.service';

interface NotificationDispatchEvent {
  recipientUserIds: string[];
  channel: string;
  subject: string;
  body: string;
  templateId?: string;
  variables?: Record<string, string>;
  agencyId?: string;
  ticketId?: string;
}

@Injectable()
export class NotificationsConsumer extends BaseKafkaConsumer implements OnModuleInit {
  protected readonly logger = new Logger(NotificationsConsumer.name);
  protected readonly groupId = 'ecitizen-notifications-consumer';
  protected readonly topics = [KAFKA_TOPICS.NOTIFICATIONS_DISPATCH];

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.startConsuming(this.kafkaService.getKafkaInstance());
  }

  protected async handleMessage(_topic: string, data: NotificationDispatchEvent): Promise<void> {
    await this.notificationsService.sendNotification({
      channel: data.channel as any,
      subject: data.subject,
      body: data.body,
      templateId: data.templateId,
      variables: data.variables,
      agencyId: data.agencyId,
      ticketId: data.ticketId,
      recipients: data.recipientUserIds.map(id => ({ recipientUserId: id })),
    });
    this.logger.log(`Notification dispatched via ${data.channel} to ${data.recipientUserIds.length} recipient(s)`);
  }
}
