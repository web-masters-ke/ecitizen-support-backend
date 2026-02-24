import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { MlController } from './ml.controller';
import { MlService } from './ml.service';

@Module({
  imports: [PrismaModule],
  controllers: [MlController],
  providers: [MlService],
  exports: [MlService],
})
export class MlModule {}
