import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaService } from '../../config/prisma.service';

/**
 * ChatModule provides REST endpoints for chat rooms and messages.
 * WebSocket broadcasting is done via AppWebSocketGateway, which is
 * provided globally by WebsocketModule (@Global) so no import needed here.
 */
@Module({
  controllers: [ChatController],
  providers: [ChatService, PrismaService],
  exports: [ChatService],
})
export class ChatModule {}
