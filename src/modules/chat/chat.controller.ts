import {
  Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards, Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto, AddParticipantDto, CreateDirectRoomDto, CreateGroupRoomDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly wsGateway: AppWebSocketGateway,
  ) {}

  // ─── Room management ────────────────────────────────────────────────────

  /** List all rooms the current user is a participant in */
  @Get('rooms')
  listRooms(@Request() req: any) {
    return this.chatService.listRooms(req.user.sub);
  }

  /** Start or resume a 1:1 direct message */
  @Post('rooms/direct')
  createDirect(@Body() dto: CreateDirectRoomDto, @Request() req: any) {
    return this.chatService.getOrCreateDirectRoom(req.user.sub, dto.targetUserId);
  }

  /** Create a group chat */
  @Post('rooms/group')
  createGroup(@Body() dto: CreateGroupRoomDto, @Request() req: any) {
    return this.chatService.createGroupRoom(req.user.sub, dto);
  }

  /** Get or create an agency-wide channel */
  @Get('rooms/agency/:agencyId')
  agencyChannel(@Param('agencyId') agencyId: string) {
    return this.chatService.getOrCreateAgencyChannel(agencyId);
  }

  /** Get room by ID */
  @Get('rooms/:roomId')
  getRoom(@Param('roomId') roomId: string) {
    return this.chatService.getRoom(roomId);
  }

  /** Rename a group / update room title */
  @Patch('rooms/:roomId')
  renameRoom(@Param('roomId') roomId: string, @Body() body: { title: string }) {
    return this.chatService.renameRoom(roomId, body.title);
  }

  // ─── Ticket + Onboarding rooms (legacy) ─────────────────────────────────

  @Get('ticket/:ticketId')
  getTicketRoom(@Param('ticketId') ticketId: string, @Request() req: any) {
    return this.chatService.getOrCreateTicketRoom(ticketId, req.user.sub);
  }

  @Get('onboarding/:agencyId')
  getOnboardingRoom(@Param('agencyId') agencyId: string) {
    return this.chatService.getOrCreateOnboardingRoom(agencyId);
  }

  // ─── Messages ───────────────────────────────────────────────────────────

  @Get(':roomId/messages')
  getMessages(
    @Param('roomId') roomId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.chatService.getMessages(roomId, Number(page), Number(limit));
  }

  @Post(':roomId/messages')
  async sendMessage(
    @Param('roomId') roomId: string,
    @Body() dto: SendMessageDto,
    @Request() req: any,
  ) {
    const senderName =
      `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    const message = await this.chatService.sendMessage(roomId, req.user.sub, senderName, dto);

    // Broadcast to clients subscribed to this room channel
    this.wsGateway.emitToChannel(`chat:${roomId}`, 'chat:message', message);

    // Also push to every participant's personal channel so the room list
    // preview and unread badge update even when the room is not active.
    const participantIds = await this.chatService.getRoomParticipantIds(roomId);
    for (const uid of participantIds) {
      if (uid !== req.user.sub) {
        this.wsGateway.emitToChannel(`user:${uid}`, 'chat:message', message);
      }
    }

    return message;
  }

  @Post(':roomId/read')
  markRead(@Param('roomId') roomId: string, @Request() req: any) {
    return this.chatService.markRead(roomId, req.user.sub);
  }

  /** Join a room via invite link (self-join) */
  @Post('rooms/:roomId/join')
  joinRoom(@Param('roomId') roomId: string, @Request() req: any) {
    return this.chatService.joinRoom(roomId, req.user.sub);
  }

  @Post(':roomId/participants')
  addParticipant(
    @Param('roomId') roomId: string,
    @Body() dto: AddParticipantDto,
    @Request() req: any,
  ) {
    const result = this.chatService.addParticipant(roomId, dto, req.user.sub);
    this.wsGateway.emitToChannel(`chat:${roomId}`, 'chat:participant_added', { addedBy: req.user.sub });
    return result;
  }

  /** Soft-delete a message (replaces body with system notice) */
  @Delete('messages/:messageId')
  async deleteMessage(@Param('messageId') messageId: string, @Request() req: any) {
    const msg = await this.chatService.deleteMessage(messageId, req.user.sub);
    this.wsGateway.emitToChannel(`chat:${msg.roomId}`, 'chat:message_deleted', { messageId, roomId: msg.roomId });
    return msg;
  }

  /** Delete a room and all its messages (group rooms only) */
  @Delete('rooms/:roomId')
  deleteRoom(@Param('roomId') roomId: string) {
    return this.chatService.deleteRoom(roomId);
  }

  /** Leave a room (removes self from participants) */
  @Delete('rooms/:roomId/participants/me')
  leaveRoom(@Param('roomId') roomId: string, @Request() req: any) {
    return this.chatService.leaveRoom(roomId, req.user.sub);
  }

  /** Remove a participant from a room (admin action) */
  @Delete('rooms/:roomId/participants/:userId')
  removeParticipant(@Param('roomId') roomId: string, @Param('userId') userId: string, @Request() req: any) {
    return this.chatService.removeParticipant(roomId, userId, req.user.sub);
  }

  /** Promote / demote a participant role: PATCH { role: "ADMIN" | "MEMBER" } */
  @Patch('rooms/:roomId/participants/:userId/role')
  setParticipantRole(
    @Param('roomId') roomId: string,
    @Param('userId') userId: string,
    @Body() body: { role: string },
  ) {
    return this.chatService.setParticipantRole(roomId, userId, body.role);
  }

  // ─── Typing indicator ───────────────────────────────────────────────────

  @Post(':roomId/typing')
  typing(
    @Param('roomId') roomId: string,
    @Body() body: { isTyping: boolean },
    @Request() req: any,
  ) {
    this.wsGateway.emitToChannel(`chat:${roomId}`, 'chat:typing', {
      userId: req.user.sub,
      userName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
      isTyping: body.isTyping ?? true,
    });
    return { ok: true };
  }

  // ─── User search (for DM / group creation) ─────────────────────────────

  @Get('search/users')
  searchUsers(@Query('q') q: string, @Request() req: any) {
    return this.chatService.searchUsers(q || '', req.user.sub);
  }

}
