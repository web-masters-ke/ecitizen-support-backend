import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SlaController } from './sla.controller';
import { SlaService } from './sla.service';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [ScheduleModule.forRoot(), KafkaModule],
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
