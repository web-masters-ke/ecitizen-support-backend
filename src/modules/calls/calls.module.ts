import { Module } from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { PrismaService } from '../../config/prisma.service';

@Module({
  controllers: [CallsController],
  providers: [CallsService, PrismaService],
  exports: [CallsService],
})
export class CallsModule {}
