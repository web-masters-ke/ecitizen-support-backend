import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class EmailIngestService {
  private readonly logger = new Logger(EmailIngestService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Parse subject for existing ticket number e.g. [#ESCC-20260423-00001]
  private extractTicketNumber(subject: string): string | null {
    const match = subject.match(/\[?#?(ESCC-\d{8}-\d{5,})\]?/i);
    return match ? match[1].toUpperCase() : null;
  }

  private async generateTicketNumber(): Promise<string> {
    const now = new Date();
    const dateStr =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');

    const prefix = `ESCC-${dateStr}-`;

    const lastTicket = await this.prisma.ticket.findFirst({
      where: { ticketNumber: { startsWith: prefix } },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });

    let sequenceNumber = 1;
    if (lastTicket) {
      const parts = lastTicket.ticketNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) sequenceNumber = lastSeq + 1;
    }

    return `${prefix}${String(sequenceNumber).padStart(5, '0')}`;
  }

  async processInboundEmail(payload: {
    from: string;
    fromName?: string;
    subject: string;
    bodyText: string;
    bodyHtml?: string;
    messageId?: string;
    attachments?: { filename: string; url: string }[];
  }) {
    const { from, fromName, subject, bodyText, messageId } = payload;

    // Check for duplicate by messageId (stored as prefix in description)
    if (messageId) {
      const existing = await this.prisma.ticket.findFirst({
        where: { description: { contains: messageId } },
      });
      if (existing) {
        this.logger.log(`Duplicate email messageId ${messageId} — skipping`);
        return { status: 'duplicate', ticketId: existing.id };
      }
    }

    // Check if this is a reply to an existing ticket
    const existingTicketNumber = this.extractTicketNumber(subject);
    if (existingTicketNumber) {
      const ticket = await this.prisma.ticket.findFirst({
        where: { ticketNumber: existingTicketNumber },
      });
      if (ticket) {
        // Add as a message on the existing ticket — TicketMessage only has senderId/messageText/messageType
        const message = await this.prisma.ticketMessage.create({
          data: {
            ticketId: ticket.id,
            messageText: `[Email from: ${fromName ?? from}]\n\n${bodyText}`,
            messageType: 'COMMENT',
            isInternal: false,
          },
        }).catch(() => null);
        this.logger.log(`Appended email to ticket ${existingTicketNumber}`);
        return { status: 'appended', ticketId: ticket.id, messageId: message?.id };
      }
    }

    // Find or determine agency from email domain
    const domain = from.split('@')[1];
    let agencyId: string | undefined;
    if (domain) {
      const agency = await this.prisma.agency.findFirst({
        where: { officialEmail: { contains: domain } },
      });
      if (agency) agencyId = agency.id;
    }

    // Find or create citizen user
    let citizen = await this.prisma.user.findFirst({ where: { email: from } });
    if (!citizen) {
      const nameParts = (fromName ?? from.split('@')[0]).split(' ');
      citizen = await this.prisma.user.create({
        data: {
          email: from,
          firstName: nameParts[0] ?? 'Email',
          lastName: nameParts[1] ?? 'User',
          userType: 'CITIZEN',
          passwordHash: '',
          isVerified: false,
        },
      }).catch(() => null);
    }

    if (!citizen) {
      return { status: 'error', reason: 'Could not find or create citizen user' };
    }

    // Resolve the OPEN status id
    const openStatus = await this.prisma.ticketStatus.findFirst({
      where: { name: 'OPEN' },
    });

    if (!openStatus) {
      return { status: 'error', reason: 'OPEN ticket status not found in database' };
    }

    // Resolve a default agency if none found (required FK on Ticket)
    if (!agencyId) {
      const firstAgency = await this.prisma.agency.findFirst();
      if (firstAgency) agencyId = firstAgency.id;
    }

    if (!agencyId) {
      return { status: 'error', reason: 'No agency available to assign ticket' };
    }

    const ticketNumber = await this.generateTicketNumber();

    // Create a new ticket
    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        subject: subject || 'Email Inquiry',
        description: `${messageId ? `[msgid:${messageId}]\n\n` : ''}${bodyText}`,
        channel: 'EMAIL',
        statusId: openStatus.id,
        agencyId,
        createdBy: citizen.id,
      },
    }).catch((err) => {
      this.logger.error('Failed to create ticket from email', err);
      return null;
    });

    if (ticket) {
      this.logger.log(`Created ticket ${ticket.ticketNumber} from email ${from}`);
      return { status: 'created', ticketId: ticket.id, ticketNumber: ticket.ticketNumber };
    }
    return { status: 'error', reason: 'Could not create ticket' };
  }
}
