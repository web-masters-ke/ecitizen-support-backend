import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailIngestService } from './email-ingest.service';
import { EmailIngestController } from './email-ingest.controller';
import { PrismaService } from '../../config/prisma.service';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [ConfigModule, forwardRef(() => KafkaModule)],
  controllers: [EmailIngestController],
  providers: [EmailIngestService, PrismaService],
  exports: [EmailIngestService],
})
export class EmailIngestModule {}
