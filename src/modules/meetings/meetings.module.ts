import { Module } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { PrismaService } from '../../config/prisma.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, PrismaService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
