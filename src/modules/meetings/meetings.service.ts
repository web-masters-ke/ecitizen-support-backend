import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

const JITSI_HOST = 'https://meet.jit.si';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: AppWebSocketGateway,
  ) {}

  async startMeeting(ticketId: string, startedById: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, ticketNumber: true, createdBy: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // End any existing active meeting for this ticket
    await this.prisma.meeting.updateMany({
      where: { ticketId, status: 'ACTIVE' },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    const roomName = `ecitizen-scc-${ticketId.replace(/-/g, '').slice(0, 16)}`;
    const jitsiUrl = `${JITSI_HOST}/${roomName}`;

    const meeting = await this.prisma.meeting.create({
      data: { ticketId, roomName, jitsiUrl, startedById, status: 'ACTIVE' },
      include: { startedBy: { select: { firstName: true, lastName: true } } },
    });

    // Notify citizen (ticket creator) via WebSocket
    this.ws.emitToUser(ticket.createdBy, 'meeting:started', {
      meetingId: meeting.id,
      ticketId,
      roomName,
      jitsiUrl,
      startedBy: `${meeting.startedBy.firstName ?? ''} ${meeting.startedBy.lastName ?? ''}`.trim(),
    });

    return meeting;
  }

  async endMeeting(meetingId: string) {
    return this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'ENDED', endedAt: new Date() },
    });
  }

  async getForTicket(ticketId: string) {
    return this.prisma.meeting.findMany({
      where: { ticketId },
      include: { startedBy: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getActive(ticketId: string) {
    return this.prisma.meeting.findFirst({
      where: { ticketId, status: 'ACTIVE' },
    });
  }
}
