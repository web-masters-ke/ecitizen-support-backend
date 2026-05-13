import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AnthropicProvider } from './providers/anthropic.provider';

@Module({
  controllers: [AiController],
  providers: [AiService, AnthropicProvider],
  exports: [AiService, AnthropicProvider],
})
export class AiModule {}
