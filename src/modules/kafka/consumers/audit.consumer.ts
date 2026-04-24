import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../kafka.service';
import { BaseKafkaConsumer } from '../kafka.consumer.base';
import { KAFKA_TOPICS } from '../kafka.topics';
import { AuditService } from '../../audit/audit.service';

interface AuditEvent {
  entityType: string;
  entityId: string;
  actionType: string;
  performedBy?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  description?: string;
}

@Injectable()
export class AuditConsumer extends BaseKafkaConsumer implements OnModuleInit {
  protected readonly logger = new Logger(AuditConsumer.name);
  protected readonly groupId = 'ecitizen-audit-consumer';
  protected readonly topics = [
    KAFKA_TOPICS.AUDIT_EVENTS,
    KAFKA_TOPICS.TICKET_CREATED,
    KAFKA_TOPICS.TICKET_UPDATED,
    KAFKA_TOPICS.TICKET_RESOLVED,
    KAFKA_TOPICS.TICKET_CLOSED,
    KAFKA_TOPICS.TICKET_ESCALATED,
    KAFKA_TOPICS.SLA_BREACHED,
  ];

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.startConsuming(this.kafkaService.getKafkaInstance());
  }

  protected async handleMessage(topic: string, data: AuditEvent): Promise<void> {
    await this.auditService.createAuditLog({
      entityType: data.entityType ?? this.topicToEntity(topic),
      entityId: data.entityId,
      actionType: data.actionType ?? this.topicToAction(topic),
      performedBy: data.performedBy,
      oldValue: data.oldValue ? { _raw: JSON.stringify(data.oldValue) } : undefined,
      newValue: data.newValue ? { _raw: JSON.stringify(data.newValue) } : undefined,
      ipAddress: data.ipAddress ?? 'kafka-event',
    });
  }

  private topicToEntity(topic: string): string {
    if (topic.includes('ticket')) return 'TICKET';
    if (topic.includes('sla')) return 'SLA';
    return 'SYSTEM';
  }

  private topicToAction(topic: string): string {
    if (topic.includes('created')) return 'CREATE';
    if (topic.includes('resolved') || topic.includes('closed')) return 'CLOSE';
    if (topic.includes('escalated') || topic.includes('breached')) return 'ESCALATE';
    return 'UPDATE';
  }
}
