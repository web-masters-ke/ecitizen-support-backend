import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { SendMessageDto, AddParticipantDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateTicketRoom(ticketId: string, creatorId: string) {
    let room = await this.prisma.chatRoom.findUnique({
      where: { ticketId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, firstName: true, lastName: true } },
            readBy: true,
          },
          take: 50,
        },
      },
    });

    if (!room) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          agencyId: true,
          createdBy: true,
          currentAssigneeId: true,
          subject: true,
        },
      });

      if (!ticket) throw new NotFoundException('Ticket not found');

      const participantData: { userId: string }[] = [];
      if (ticket.createdBy) {
        participantData.push({ userId: ticket.createdBy });
      }
      if (
        ticket.currentAssigneeId &&
        ticket.currentAssigneeId !== ticket.createdBy
      ) {
        participantData.push({ userId: ticket.currentAssigneeId });
      }

      room = await this.prisma.chatRoom.create({
        data: {
          type: 'TICKET',
          ticketId,
          title: `Ticket Chat: ${ticket.subject?.substring(0, 50)}`,
          participants: {
            create: participantData,
          },
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              sender: { select: { id: true, firstName: true, lastName: true } },
              readBy: true,
            },
          },
        },
      });
    }

    return room;
  }

  async getOrCreateOnboardingRoom(agencyId: string) {
    let room = await this.prisma.chatRoom.findFirst({
      where: { agencyId, type: 'ONBOARDING' },
      include: {
        participants: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, firstName: true, lastName: true } },
            readBy: true,
          },
        },
      },
    });

    if (!room) {
      const agency = await this.prisma.agency.findUnique({
        where: { id: agencyId },
        select: { agencyName: true, coordinatorId: true },
      });

      if (!agency) throw new NotFoundException('Agency not found');

      room = await this.prisma.chatRoom.create({
        data: {
          type: 'ONBOARDING',
          agencyId,
          title: `Onboarding: ${agency.agencyName}`,
          participants: {
            create: agency.coordinatorId
              ? [{ userId: agency.coordinatorId }]
              : [],
          },
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              sender: { select: { id: true, firstName: true, lastName: true } },
              readBy: true,
            },
          },
        },
      });
    }

    return room;
  }

  async sendMessage(
    roomId: string,
    senderId: string,
    senderName: string,
    dto: SendMessageDto,
  ) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Chat room not found');

    let messageType: 'TEXT' | 'FILE' | 'IMAGE' = 'TEXT';
    if (dto.fileUrl) {
      messageType = dto.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
        ? 'IMAGE'
        : 'FILE';
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        roomId,
        senderId,
        senderName,
        body: dto.body,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        messageType,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
        readBy: true,
      },
    });

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getMessages(roomId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: { select: { id: true, firstName: true, lastName: true } },
          readBy: {
            include: {
              user: { select: { id: true, firstName: true } },
            },
          },
        },
      }),
      this.prisma.chatMessage.count({ where: { roomId } }),
    ]);

    return { messages: messages.reverse(), total, page, limit };
  }

  async markRead(roomId: string, userId: string) {
    const messages = await this.prisma.chatMessage.findMany({
      where: { roomId, senderId: { not: userId } },
      select: { id: true },
    });

    for (const msg of messages) {
      await this.prisma.chatReadReceipt.upsert({
        where: { messageId_userId: { messageId: msg.id, userId } },
        create: { messageId: msg.id, userId },
        update: {},
      });
    }

    return { markedRead: messages.length };
  }

  async addParticipant(roomId: string, dto: AddParticipantDto, addedBy: string) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Chat room not found');

    return this.prisma.chatParticipant.create({
      data: { roomId, userId: dto.userId, email: dto.email, addedBy },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async getRoom(roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, firstName: true, lastName: true } },
            readBy: true,
          },
          take: 100,
        },
      },
    });

    if (!room) throw new NotFoundException('Chat room not found');
    return room;
  }
}
