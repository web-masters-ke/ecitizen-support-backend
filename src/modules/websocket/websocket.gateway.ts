import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

// ============================================
// Types
// ============================================

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
    userType: string;
    agencyId?: string;
    subscribedChannels: Set<string>;
  };
}

export enum WsChannel {
  TICKET_UPDATES = 'ticket_updates',
  SLA_BREACH_EVENTS = 'sla_breach_events',
  NATIONAL_LIVE_FEED = 'national_live_feed',
}

export enum WsEvent {
  // Client -> Server
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',

  // Server -> Client
  TICKET_STATUS_UPDATED = 'TICKET_STATUS_UPDATED',
  TICKET_ESCALATED = 'TICKET_ESCALATED',
  SLA_BREACH = 'SLA_BREACH',
  AI_CLASSIFICATION_READY = 'AI_CLASSIFICATION_READY',
  HEARTBEAT = 'heartbeat',

  // System
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBED = 'unsubscribed',
  ERROR = 'error',
}

interface SubscribePayload {
  channel: string;
}

interface UnsubscribePayload {
  channel: string;
}

// ============================================
// Gateway
// ============================================

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
})
export class AppWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppWebSocketGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();
  private heartbeatInterval: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {}

  // ============================================
  // Lifecycle Hooks
  // ============================================

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Start heartbeat interval (every 30 seconds)
    this.heartbeatInterval = setInterval(() => {
      this.broadcastHeartbeat();
    }, 30000);
  }

  /**
   * Handle new connection - authenticate via JWT in query params
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.query.token as string ||
        client.handshake.auth?.token as string ||
        this.extractTokenFromHeader(client);

      if (!token) {
        this.logger.warn(
          `Connection rejected: no token provided (${client.id})`,
        );
        client.emit(WsEvent.ERROR, { message: 'Authentication token required' });
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>(
        'JWT_SECRET',
        'ecitizen-scc-secret-key',
      );

      const payload = jwt.verify(token, secret) as {
        sub: string;
        email: string;
        userType: string;
        agencyId?: string;
      };

      // Attach user data to socket
      client.data = {
        userId: payload.sub,
        email: payload.email,
        userType: payload.userType,
        agencyId: payload.agencyId,
        subscribedChannels: new Set<string>(),
      };

      // Store client reference
      this.connectedClients.set(client.id, client);

      // Join user-specific room
      client.join(`user:${payload.sub}`);

      // Auto-join agency room if user belongs to an agency
      if (payload.agencyId) {
        client.join(`agency:${payload.agencyId}`);
        client.data.subscribedChannels.add(`agency:${payload.agencyId}`);
      }

      this.logger.log(
        `Client connected: ${client.id} (user: ${payload.sub}, type: ${payload.userType})`,
      );

      // Confirm connection with client metadata
      client.emit('connected', {
        clientId: client.id,
        userId: payload.sub,
        userType: payload.userType,
        agencyId: payload.agencyId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(
        `Connection rejected: invalid token (${client.id}): ${error.message}`,
      );
      client.emit(WsEvent.ERROR, { message: 'Invalid or expired authentication token' });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data?.userId || 'unknown';
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id} (user: ${userId})`);
  }

  // ============================================
  // Channel Subscription Handlers
  // ============================================

  /**
   * Subscribe to a channel
   * Valid channels: ticket_updates, sla_breach_events, agency:{agencyId}, national_live_feed
   */
  @SubscribeMessage(WsEvent.SUBSCRIBE)
  handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SubscribePayload,
  ) {
    const { channel } = payload;

    if (!channel) {
      throw new WsException('Channel name is required');
    }

    // Validate channel name
    if (!this.isValidChannel(channel, client)) {
      throw new WsException(`Invalid or unauthorized channel: ${channel}`);
    }

    // Join the socket.io room for this channel
    client.join(channel);
    client.data.subscribedChannels.add(channel);

    this.logger.log(
      `Client ${client.id} subscribed to channel: ${channel}`,
    );

    client.emit(WsEvent.SUBSCRIBED, {
      channel,
      timestamp: new Date().toISOString(),
    });

    return { event: WsEvent.SUBSCRIBED, data: { channel } };
  }

  /**
   * Unsubscribe from a channel
   */
  @SubscribeMessage(WsEvent.UNSUBSCRIBE)
  handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: UnsubscribePayload,
  ) {
    const { channel } = payload;

    if (!channel) {
      throw new WsException('Channel name is required');
    }

    client.leave(channel);
    client.data.subscribedChannels.delete(channel);

    this.logger.log(
      `Client ${client.id} unsubscribed from channel: ${channel}`,
    );

    client.emit(WsEvent.UNSUBSCRIBED, {
      channel,
      timestamp: new Date().toISOString(),
    });

    return { event: WsEvent.UNSUBSCRIBED, data: { channel } };
  }

  // ============================================
  // Event Broadcasting Methods (for other services)
  // ============================================

  /**
   * Emit an event to a specific channel/room.
   * This is the primary method other services call to push events.
   */
  emitToChannel(channel: string, event: string, data: any): void {
    this.server.to(channel).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(
      `Event "${event}" emitted to channel "${channel}"`,
    );
  }

  /**
   * Broadcast a ticket status update
   */
  emitTicketStatusUpdated(ticketId: string, agencyId: string, data: any): void {
    const payload = {
      ticketId,
      agencyId,
      ...data,
    };

    // Emit to ticket_updates channel
    this.emitToChannel(WsChannel.TICKET_UPDATES, WsEvent.TICKET_STATUS_UPDATED, payload);

    // Emit to agency-specific channel
    this.emitToChannel(`agency:${agencyId}`, WsEvent.TICKET_STATUS_UPDATED, payload);

    // Emit to national live feed
    this.emitToChannel(WsChannel.NATIONAL_LIVE_FEED, WsEvent.TICKET_STATUS_UPDATED, payload);
  }

  /**
   * Broadcast a ticket escalation event
   */
  emitTicketEscalated(ticketId: string, agencyId: string, data: any): void {
    const payload = {
      ticketId,
      agencyId,
      ...data,
    };

    this.emitToChannel(WsChannel.TICKET_UPDATES, WsEvent.TICKET_ESCALATED, payload);
    this.emitToChannel(`agency:${agencyId}`, WsEvent.TICKET_ESCALATED, payload);
    this.emitToChannel(WsChannel.NATIONAL_LIVE_FEED, WsEvent.TICKET_ESCALATED, payload);
  }

  /**
   * Broadcast an SLA breach event
   */
  emitSlaBreach(ticketId: string, agencyId: string, data: any): void {
    const payload = {
      ticketId,
      agencyId,
      ...data,
    };

    this.emitToChannel(WsChannel.SLA_BREACH_EVENTS, WsEvent.SLA_BREACH, payload);
    this.emitToChannel(`agency:${agencyId}`, WsEvent.SLA_BREACH, payload);
    this.emitToChannel(WsChannel.NATIONAL_LIVE_FEED, WsEvent.SLA_BREACH, payload);
  }

  /**
   * Broadcast AI classification ready event
   */
  emitAiClassificationReady(ticketId: string, agencyId: string, data: any): void {
    const payload = {
      ticketId,
      agencyId,
      ...data,
    };

    this.emitToChannel(WsChannel.TICKET_UPDATES, WsEvent.AI_CLASSIFICATION_READY, payload);
    this.emitToChannel(`agency:${agencyId}`, WsEvent.AI_CLASSIFICATION_READY, payload);
  }

  /**
   * Emit event to a specific user
   */
  emitToUser(userId: string, event: string, data: any): void {
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit event to all connected clients
   */
  broadcast(event: string, data: any): void {
    this.server.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================
  // Heartbeat
  // ============================================

  /**
   * Send heartbeat to all connected clients every 30 seconds
   */
  private broadcastHeartbeat(): void {
    const clientCount = this.connectedClients.size;

    this.server.emit(WsEvent.HEARTBEAT, {
      timestamp: new Date().toISOString(),
      connectedClients: clientCount,
    });

    if (clientCount > 0) {
      this.logger.debug(
        `Heartbeat sent to ${clientCount} connected client(s)`,
      );
    }
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Validate if a channel name is valid and the user has access
   */
  private isValidChannel(channel: string, client: AuthenticatedSocket): boolean {
    // Standard channels anyone can subscribe to
    const publicChannels = [
      WsChannel.TICKET_UPDATES,
      WsChannel.SLA_BREACH_EVENTS,
      WsChannel.NATIONAL_LIVE_FEED,
    ];

    if (publicChannels.includes(channel as WsChannel)) {
      return true;
    }

    // Agency-specific channels: agency:{agencyId}
    if (channel.startsWith('agency:')) {
      const agencyId = channel.replace('agency:', '');

      // Admins can subscribe to any agency channel
      if (
        client.data.userType === 'COMMAND_CENTER_ADMIN' ||
        client.data.userType === 'SUPER_ADMIN'
      ) {
        return true;
      }

      // Agency users can only subscribe to their own agency
      if (client.data.agencyId === agencyId) {
        return true;
      }

      return false;
    }

    return false;
  }

  /**
   * Extract JWT token from Authorization header
   */
  private extractTokenFromHeader(client: Socket): string | undefined {
    const authHeader = client.handshake.headers.authorization;
    if (!authHeader) return undefined;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  /**
   * Get current connection stats
   */
  getConnectionStats() {
    const stats = {
      totalConnections: this.connectedClients.size,
      connectionsByType: {} as Record<string, number>,
      connectionsByAgency: {} as Record<string, number>,
    };

    for (const [, client] of this.connectedClients) {
      const userType = client.data?.userType || 'unknown';
      stats.connectionsByType[userType] =
        (stats.connectionsByType[userType] || 0) + 1;

      if (client.data?.agencyId) {
        stats.connectionsByAgency[client.data.agencyId] =
          (stats.connectionsByAgency[client.data.agencyId] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Clean up on module destroy
   */
  onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Disconnect all clients gracefully
    for (const [, client] of this.connectedClients) {
      client.disconnect();
    }

    this.connectedClients.clear();
    this.logger.log('WebSocket Gateway shutting down');
  }
}
