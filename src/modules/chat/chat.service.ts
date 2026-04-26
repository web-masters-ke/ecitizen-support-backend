import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { SendMessageDto, AddParticipantDto, CreateGroupRoomDto } from './dto/chat.dto';

const ROOM_INCLUDE = {
  participants: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, userType: true } },
    },
    orderBy: [{ role: 'asc' as const }, { addedAt: 'asc' as const }],
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

      const seen = new Set<string>();
      const participants: { userId: string }[] = [];
      for (const uid of [ticket.createdBy, ticket.currentAssigneeId, creatorId]) {
        if (uid && !seen.has(uid)) { seen.add(uid); participants.push({ userId: uid }); }
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
    } else if (creatorId) {
      // Auto-enroll the requesting admin if not already a participant
      const already = await this.prisma.chatParticipant.findUnique({
        where: { roomId_userId: { roomId: room.id, userId: creatorId } },
      });
      if (!already) {
        await this.prisma.chatParticipant.create({ data: { roomId: room.id, userId: creatorId } }).catch(() => {});
        // Reload room with the new participant
        room = await this.prisma.chatRoom.findUnique({ where: { id: room.id }, include: ROOM_INCLUDE }) ?? room;
      }
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

    // Auto-enroll sender as participant so the room appears in their chat history
    await this.prisma.chatParticipant.upsert({
      where: { roomId_userId: { roomId, userId: senderId } },
      create: { roomId, userId: senderId },
      update: {},
    }).catch(() => {});

    let messageType: 'TEXT' | 'FILE' | 'IMAGE' | 'VOICE' | 'SYSTEM' = 'TEXT';
    if (dto.messageType === 'SYSTEM') {
      messageType = 'SYSTEM';
    } else if (dto.messageType === 'VOICE') {
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

    // Resolve email to userId if needed
    let userId = dto.userId;
    if (!userId && dto.email) {
      const user = await this.prisma.user.findFirst({ where: { email: dto.email } });
      if (user) userId = user.id;
    }

    // Skip if already a participant
    if (userId) {
      const existing = await this.prisma.chatParticipant.findFirst({ where: { roomId, userId } });
      if (existing) return existing;
    }

    return this.prisma.chatParticipant.create({
      data: { roomId, userId: userId ?? null, email: dto.email ?? null, addedBy },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  // ─── Self-join via invite link ─────────────────────────────────────────
  async joinRoom(roomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId }, include: { participants: true } });
    if (!room) throw new NotFoundException('Room not found');
    const already = room.participants.find((p) => p.userId === userId);
    if (already) return room;
    await this.prisma.chatParticipant.create({ data: { roomId, userId } });
    return this.getRoom(roomId);
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

  // ─── Delete message (soft) ───────────────────────────────────────────────
  async deleteMessage(messageId: string, requesterId: string) {
    const msg = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== requesterId) throw new BadRequestException('Cannot delete someone else\'s message');
    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { body: null, messageType: 'SYSTEM', fileUrl: null, fileName: null },
    });
  }

  // ─── Leave room ──────────────────────────────────────────────────────────
  async leaveRoom(roomId: string, userId: string) {
    await this.prisma.chatParticipant.deleteMany({ where: { roomId, userId } });
    return { ok: true };
  }

  // ─── Remove participant ───────────────────────────────────────────────────
  async removeParticipant(roomId: string, targetUserId: string, requesterId: string) {
    if (targetUserId === requesterId) return this.leaveRoom(roomId, requesterId);
    await this.prisma.chatParticipant.deleteMany({ where: { roomId, userId: targetUserId } });
    return { ok: true };
  }

  // ─── Set participant role (MEMBER / ADMIN) ────────────────────────────────
  async setParticipantRole(roomId: string, targetUserId: string, role: string) {
    const validRoles = ['MEMBER', 'ADMIN'];
    const safeRole = validRoles.includes(role?.toUpperCase()) ? role.toUpperCase() : 'MEMBER';
    await this.prisma.chatParticipant.updateMany({
      where: { roomId, userId: targetUserId },
      data: { role: safeRole },
    });
    return { ok: true, role: safeRole };
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
