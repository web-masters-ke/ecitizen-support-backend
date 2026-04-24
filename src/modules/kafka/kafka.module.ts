import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaService } from './kafka.service';
import { EmailIngestConsumer } from './consumers/email-ingest.consumer';
import { NotificationsConsumer } from './consumers/notifications.consumer';
import { AuditConsumer } from './consumers/audit.consumer';
import { SlaConsumer } from './consumers/sla.consumer';
import { EmailIngestModule } from '../email-ingest/email-ingest.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    ConfigModule,
    EmailIngestModule,
    NotificationsModule,
    AuditModule,
  ],
  providers: [
    KafkaService,
    EmailIngestConsumer,
    NotificationsConsumer,
    AuditConsumer,
    SlaConsumer,
  ],
  exports: [KafkaService],
})
export class KafkaModule {}
