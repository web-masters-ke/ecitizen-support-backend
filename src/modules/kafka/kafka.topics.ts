export const KAFKA_TOPICS = {
  EMAIL_INGEST:            'ecitizen.email.ingest',
  TICKET_CREATED:          'ecitizen.tickets.created',
  TICKET_UPDATED:          'ecitizen.tickets.updated',
  TICKET_ASSIGNED:         'ecitizen.tickets.assigned',
  TICKET_RESOLVED:         'ecitizen.tickets.resolved',
  TICKET_CLOSED:           'ecitizen.tickets.closed',
  TICKET_ESCALATED:        'ecitizen.tickets.escalated',
  SLA_BREACHED:            'ecitizen.sla.breached',
  NOTIFICATIONS_DISPATCH:  'ecitizen.notifications.dispatch',
  AUDIT_EVENTS:            'ecitizen.audit.events',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

// Partition key helpers — route related messages to same partition for ordering
export const partitionKey = {
  byTicket:  (ticketId: string)  => ticketId,
  byAgency:  (agencyId: string)  => agencyId,
  byUser:    (userId: string)    => userId,
};
