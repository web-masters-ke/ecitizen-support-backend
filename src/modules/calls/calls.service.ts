import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async startCall(callerId: string, targetUserId: string, ticketId?: string, agencyId?: string, direction = 'OUTBOUND') {
    return this.prisma.callLog.create({
      data: {
        callerId,
        targetUserId: targetUserId || undefined,
        ticketId: ticketId || undefined,
        agencyId: agencyId || undefined,
        direction: direction as any,
        status: 'RINGING',
      },
    });
  }

  async updateCall(id: string, status: string, durationSec?: number, notes?: string) {
    const updated = await this.prisma.callLog.update({
      where: { id },
      data: {
        status: status as any,
        ...(status === 'ENDED' || status === 'MISSED' || status === 'FAILED' ? { endedAt: new Date() } : {}),
        ...(durationSec !== undefined ? { durationSec } : {}),
        ...(notes ? { notes } : {}),
      },
    });

    // Out-of-band notification on missed / failed calls. Agents are
    // only notified of incoming calls when actively logged into the
    // admin app (WebRTC + socket listener); this covers the gap when
    // they're offline by email + SMS. Fire-and-forget — never blocks
    // the status update.
    if (status === 'MISSED' || status === 'FAILED') {
      this.notifyMissedCall(id).catch((err) =>
        this.logger.warn(`Missed-call notification failed for ${id}: ${(err as Error)?.message}`),
      );
    }
    return updated;
  }

  /**
   * When a call goes MISSED / FAILED, ping the target agent on every
   * channel we have so they know to call the citizen back: in-app
   * notification + email + SMS. Best-effort across each channel — a
   * failure on one doesn't block the others.
   */
  private async notifyMissedCall(callLogId: string): Promise<void> {
    const call = await this.prisma.callLog.findUnique({
      where: { id: callLogId },
      include: {
        caller: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
        target: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
        ticket: { select: { id: true, ticketNumber: true, subject: true } },
      },
    });
    if (!call || !call.target) return;

    const callerName =
      [call.caller?.firstName, call.caller?.lastName].filter(Boolean).join(' ').trim() ||
      call.caller?.email ||
      'A citizen';
    const ticketRef = call.ticket?.ticketNumber ? ` about ticket ${call.ticket.ticketNumber}` : '';
    const adminUrl = process.env.ADMIN_FRONTEND_URL || 'https://admin-ecitizen.wasaahost.com';
    const ticketLink = call.ticket?.id ? `${adminUrl}/tickets/${call.ticket.id}` : adminUrl;

    const subject = `Missed call — ${callerName}${ticketRef}`;
    const body = `Hi ${call.target.firstName ?? 'there'},

${callerName} tried to call you${ticketRef} but couldn't reach you.${call.ticket?.subject ? `\n\nTicket: ${call.ticket.subject}` : ''}

Open the ticket to call them back:
${ticketLink}

eCitizen Service Command Centre`;
    const smsBody = `eCitizen SCC: Missed call from ${callerName}${ticketRef}. Call back: ${ticketLink}`;

    const recipient = {
      recipientUserId: call.target.id,
      recipientEmail: call.target.email ?? undefined,
      recipientPhone: call.target.phoneNumber ?? undefined,
    };

    // In-app — shows up in the agent's notification bell on next page load
    this.notifications
      .sendNotification({
        ticketId: call.ticket?.id,
        channel: 'IN_APP' as any,
        triggerEvent: 'MISSED_CALL',
        subject,
        body,
        recipients: [recipient],
      })
      .catch((err) => this.logger.warn(`IN_APP missed-call notify failed: ${err?.message}`));

    if (call.target.email) {
      this.notifications
        .sendNotification({
          ticketId: call.ticket?.id,
          channel: 'EMAIL' as any,
          triggerEvent: 'MISSED_CALL',
          subject,
          body,
          recipients: [recipient],
        })
        .catch((err) => this.logger.warn(`EMAIL missed-call notify failed: ${err?.message}`));
    }

    if (call.target.phoneNumber) {
      this.notifications
        .sendNotification({
          ticketId: call.ticket?.id,
          channel: 'SMS' as any,
          triggerEvent: 'MISSED_CALL',
          subject: 'Missed call',
          body: smsBody,
          recipients: [recipient],
        })
        .catch((err) => this.logger.warn(`SMS missed-call notify failed: ${err?.message}`));
    }

    this.logger.log(
      `Missed-call notifications queued for ${call.target.id} (caller=${callerName}, ticket=${call.ticket?.ticketNumber ?? 'n/a'})`,
    );
  }

  async getCallsForTicket(ticketId: string) {
    return this.prisma.callLog.findMany({
      where: { ticketId },
      include: {
        caller: { select: { id: true, firstName: true, lastName: true, email: true } },
        target: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getCallsForAgency(agencyId: string) {
    return this.prisma.callLog.findMany({
      where: { agencyId },
      include: {
        caller: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  async getRecentCalls(userId: string, limit = 20) {
    return this.prisma.callLog.findMany({
      where: { OR: [{ callerId: userId }, { targetUserId: userId }] },
      include: {
        caller: { select: { id: true, firstName: true, lastName: true, email: true } },
        target: { select: { id: true, firstName: true, lastName: true, email: true } },
        ticket: { select: { id: true, ticketNumber: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }
}
