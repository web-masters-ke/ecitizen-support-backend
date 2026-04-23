import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto, AddParticipantDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly wsGateway: AppWebSocketGateway,
  ) {}

  @Get('ticket/:ticketId')
  getTicketRoom(
    @Param('ticketId') ticketId: string,
    @Request() req: any,
  ) {
    return this.chatService.getOrCreateTicketRoom(ticketId, req.user.sub);
  }

  @Get('onboarding/:agencyId')
  getOnboardingRoom(@Param('agencyId') agencyId: string) {
    return this.chatService.getOrCreateOnboardingRoom(agencyId);
  }

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
      `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() ||
      req.user.email;

    const message = await this.chatService.sendMessage(
      roomId,
      req.user.sub,
      senderName,
      dto,
    );

    // Broadcast via WebSocket to all subscribers of this room's channel
    this.wsGateway.emitToChannel(`chat:${roomId}`, 'chat:message', message);

    return message;
  }

  @Post(':roomId/read')
  markRead(@Param('roomId') roomId: string, @Request() req: any) {
    return this.chatService.markRead(roomId, req.user.sub);
  }

  @Post(':roomId/participants')
  addParticipant(
    @Param('roomId') roomId: string,
    @Body() dto: AddParticipantDto,
    @Request() req: any,
  ) {
    return this.chatService.addParticipant(roomId, dto, req.user.sub);
  }

  @Get(':roomId')
  getRoom(@Param('roomId') roomId: string) {
    return this.chatService.getRoom(roomId);
  }
}
