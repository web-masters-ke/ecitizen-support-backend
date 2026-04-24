import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class CallsService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.callLog.update({
      where: { id },
      data: {
        status: status as any,
        ...(status === 'ENDED' || status === 'MISSED' || status === 'FAILED' ? { endedAt: new Date() } : {}),
        ...(durationSec !== undefined ? { durationSec } : {}),
        ...(notes ? { notes } : {}),
      },
    });
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
