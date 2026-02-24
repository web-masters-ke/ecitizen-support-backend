import { Global, Module } from '@nestjs/common';
import { AppWebSocketGateway } from './websocket.gateway';

/**
 * The WebSocket module is marked as @Global so that other modules
 * (e.g. TicketsModule, SlaModule) can inject the gateway directly
 * to emit real-time events without circular imports.
 */
@Global()
@Module({
  providers: [AppWebSocketGateway],
  exports: [AppWebSocketGateway],
})
export class WebsocketModule {}
