import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SlaController } from './sla.controller';
import { SlaService } from './sla.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
