import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../kafka.service';
import { BaseKafkaConsumer } from '../kafka.consumer.base';
import { KAFKA_TOPICS } from '../kafka.topics';
import { EmailIngestService } from '../../email-ingest/email-ingest.service';

interface EmailIngestEvent {
  from: string;
  fromName?: string;
  subject: string;
  bodyText: string;
  messageId?: string;
}

@Injectable()
export class EmailIngestConsumer extends BaseKafkaConsumer implements OnModuleInit {
  protected readonly logger = new Logger(EmailIngestConsumer.name);
  protected readonly groupId = 'ecitizen-email-ingest-consumer';
  protected readonly topics = [KAFKA_TOPICS.EMAIL_INGEST];

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly emailIngestService: EmailIngestService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.startConsuming(this.kafkaService.getKafkaInstance());
  }

  protected async handleMessage(_topic: string, data: EmailIngestEvent): Promise<void> {
    const result = await this.emailIngestService.processInboundEmail(data);
    this.logger.log(`Email processed → ${result.status} ${result.ticketNumber ?? result.ticketId ?? ''}`);
  }
}
