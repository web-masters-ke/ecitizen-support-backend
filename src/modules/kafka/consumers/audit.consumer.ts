import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../kafka.service';
import { BaseKafkaConsumer } from '../kafka.consumer.base';
import { KAFKA_TOPICS } from '../kafka.topics';
import { AuditService } from '../../audit/audit.service';

interface AuditEvent {
  // Generic shape (used by AUDIT_EVENTS)
  entityType?: string;
  entityId?: string;
  actionType?: string;
  performedBy?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  description?: string;
  // Domain-event fields (TICKET_*, SLA_*)
  ticketId?: string;
  createdBy?: string;
  actorId?: string;
  resolvedBy?: string;
  closedBy?: string;
  escalatedBy?: string;
  // Plus arbitrary other payload fields we serialize as newValue
  [k: string]: unknown;
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
    // AUDIT_EVENTS uses the explicit shape; domain events (TICKET_*, SLA_*)
    // publish ticketId/createdBy/etc, so map those onto the audit columns.
    const entityId = data.entityId ?? data.ticketId;
    const performedBy =
      data.performedBy ??
      data.actorId ??
      data.createdBy ??
      data.resolvedBy ??
      data.closedBy ??
      data.escalatedBy;

    // For domain events the entire payload is the post-state; for AUDIT_EVENTS
    // honour the explicit newValue/oldValue.
    const isAuditEventTopic = topic === KAFKA_TOPICS.AUDIT_EVENTS;
    const newValue = isAuditEventTopic ? data.newValue : (data.newValue ?? data);
    const oldValue = data.oldValue;

    await this.auditService.createAuditLog({
      entityType: data.entityType ?? this.topicToEntity(topic),
      entityId,
      actionType: data.actionType ?? this.topicToAction(topic),
      performedBy,
      oldValue: oldValue ? { _raw: JSON.stringify(oldValue) } : undefined,
      newValue: newValue ? { _raw: JSON.stringify(newValue) } : undefined,
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
