import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { BrevoProvider } from './providers/brevo.provider';
import { BongaProvider } from './providers/bonga.provider';

@Module({
  imports: [ConfigModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, BrevoProvider, BongaProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
