import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { SendMessageDto, AddParticipantDto, CreateGroupRoomDto } from './dto/chat.dto';

const ROOM_INCLUDE = {
  participants: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, userType: true } },
    },
  },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true } },
      readBy: true,
    },
    take: 60,
  },
};

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Room list ────────────────────────────────────────────────────────
  async listRooms(userId: string) {
    const participations = await this.prisma.chatParticipant.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            participants: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, userType: true } },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { room: { updatedAt: 'desc' } },
    });

    return participations.map((p) => {
      const room = p.room;
      const lastMsg = room.messages[0] ?? null;
      const unread = 0; // computed client-side from readBy
      return { ...room, lastMessage: lastMsg, unreadCount: unread };
    });
  }

  // ─── Direct (1:1) room ────────────────────────────────────────────────
  async getOrCreateDirectRoom(userId: string, targetUserId: string) {
    if (userId === targetUserId) throw new BadRequestException('Cannot start a DM with yourself');

    // Find existing DIRECT room with exactly these two participants
    const existing = await this.prisma.chatRoom.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
      include: ROOM_INCLUDE,
    });

    if (existing) return existing;

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!targetUser) throw new NotFoundException('Target user not found');

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });

    const title = `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim()
      + ' & '
      + `${targetUser.firstName ?? ''} ${targetUser.lastName ?? ''}`.trim();

    return this.prisma.chatRoom.create({
      data: {
        type: 'DIRECT',
        title,
        participants: { create: [{ userId }, { userId: targetUserId }] },
      },
      include: ROOM_INCLUDE,
    });
  }

  // ─── Group room ───────────────────────────────────────────────────────
  async createGroupRoom(creatorId: string, dto: CreateGroupRoomDto) {
    const allMembers = Array.from(new Set([creatorId, ...dto.memberIds]));
    return this.prisma.chatRoom.create({
      data: {
        type: 'GROUP',
        title: dto.title,
        participants: { create: allMembers.map((uid) => ({ userId: uid, addedBy: creatorId })) },
      },
      include: ROOM_INCLUDE,
    });
  }

  // ─── Rename room ─────────────────────────────────────────────────────
  async renameRoom(roomId: string, title: string) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    return this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { title: title.trim() },
      include: ROOM_INCLUDE,
    });
  }

  // ─── Agency channel ───────────────────────────────────────────────────
  async getOrCreateAgencyChannel(agencyId: string) {
    let room = await this.prisma.chatRoom.findFirst({
      where: { agencyId, type: 'AGENCY_CHANNEL' },
      include: ROOM_INCLUDE,
    });

    if (!room) {
      const agency = await this.prisma.agency.findUnique({
        where: { id: agencyId },
        select: { agencyName: true },
      });
      if (!agency) throw new NotFoundException('Agency not found');

      room = await this.prisma.chatRoom.create({
        data: {
          type: 'AGENCY_CHANNEL',
          agencyId,
          title: `${agency.agencyName} Channel`,
        },
        include: ROOM_INCLUDE,
      });
    }

    return room;
  }

  // ─── Ticket room ──────────────────────────────────────────────────────
  async getOrCreateTicketRoom(ticketId: string, creatorId: string) {
    let room = await this.prisma.chatRoom.findUnique({
      where: { ticketId },
      include: ROOM_INCLUDE,
    });

    if (!room) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, createdBy: true, currentAssigneeId: true, subject: true },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');

      const participants: { userId: string }[] = [];
      if (ticket.createdBy) participants.push({ userId: ticket.createdBy });
      if (ticket.currentAssigneeId && ticket.currentAssigneeId !== ticket.createdBy) {
        participants.push({ userId: ticket.currentAssigneeId });
      }

      room = await this.prisma.chatRoom.create({
        data: {
          type: 'TICKET',
          ticketId,
          title: `Ticket Chat: ${ticket.subject?.substring(0, 50)}`,
          participants: { create: participants },
        },
        include: ROOM_INCLUDE,
      });
    }

    return room;
  }

  // ─── Onboarding room ──────────────────────────────────────────────────
  async getOrCreateOnboardingRoom(agencyId: string) {
    let room = await this.prisma.chatRoom.findFirst({
      where: { agencyId, type: 'ONBOARDING' },
      include: ROOM_INCLUDE,
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
          participants: { create: agency.coordinatorId ? [{ userId: agency.coordinatorId }] : [] },
        },
        include: ROOM_INCLUDE,
      });
    }

    return room;
  }

  // ─── Messages ─────────────────────────────────────────────────────────
  async sendMessage(roomId: string, senderId: string, senderName: string, dto: SendMessageDto) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Chat room not found');

    let messageType: 'TEXT' | 'FILE' | 'IMAGE' | 'VOICE' = 'TEXT';
    if (dto.messageType === 'VOICE') {
      messageType = 'VOICE';
    } else if (dto.fileUrl) {
      messageType = dto.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'IMAGE' : 'FILE';
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        roomId,
        senderId,
        senderName,
        body: dto.body ?? null,
        fileUrl: dto.fileUrl ?? null,
        fileName: dto.fileName ?? null,
        messageType,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
        readBy: true,
      },
    });

    await this.prisma.chatRoom.update({ where: { id: roomId }, data: { updatedAt: new Date() } });
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
          readBy: { include: { user: { select: { id: true, firstName: true } } } },
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
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async getRoom(roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, userType: true } },
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

  // ─── Search users (for new DM/group creation) ─────────────────────────
  async searchUsers(query: string, excludeUserId: string) {
    return this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
        isActive: true,
        deletedAt: null,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, userType: true },
      take: 20,
    });
  }
}
