import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../../config/redis.service';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Overall health check - includes all component checks
   */
  async getHealth(): Promise<HealthCheckResult> {
    const [dbHealth, redisHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allUp = dbHealth.status === 'up' && redisHealth.status === 'up';
    const allDown = dbHealth.status === 'down' && redisHealth.status === 'down';

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allUp) {
      status = 'healthy';
    } else if (allDown) {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.APP_VERSION || '1.0.0',
      checks: {
        database: dbHealth,
        redis: redisHealth,
      },
    };
  }

  /**
   * Liveness probe - simply returns OK if the process is running.
   * Kubernetes uses this to determine if the container needs to be restarted.
   */
  async getLiveness(): Promise<{ status: 'alive'; timestamp: string; uptime: number }> {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /**
   * Readiness probe - checks that all external dependencies (DB, Redis)
   * are reachable. Kubernetes uses this to determine if the pod should
   * receive traffic.
   */
  async getReadiness(): Promise<{
    status: 'ready' | 'not_ready';
    timestamp: string;
    checks: { database: ComponentHealth; redis: ComponentHealth };
  }> {
    const [dbHealth, redisHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    // The service is ready only if the database is up.
    // Redis being down is tolerable (degraded mode).
    const isReady = dbHealth.status === 'up';

    return {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
        redis: redisHealth,
      },
    };
  }

  /**
   * Check database connectivity by running a simple query
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const isHealthy = await this.prisma.isHealthy();
      const latencyMs = Date.now() - start;

      if (isHealthy) {
        return {
          status: 'up',
          latencyMs,
          message: 'PostgreSQL connection is healthy',
        };
      }

      return {
        status: 'down',
        latencyMs,
        message: 'PostgreSQL health check returned false',
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      this.logger.error('Database health check failed', error.message);
      return {
        status: 'down',
        latencyMs,
        message: `PostgreSQL connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Check Redis connectivity by sending a PING command
   */
  private async checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const isHealthy = await this.redis.isHealthy();
      const latencyMs = Date.now() - start;

      if (isHealthy) {
        return {
          status: 'up',
          latencyMs,
          message: 'Redis connection is healthy',
        };
      }

      return {
        status: 'down',
        latencyMs,
        message: 'Redis PING did not return PONG',
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      this.logger.error('Redis health check failed', error.message);
      return {
        status: 'down',
        latencyMs,
        message: `Redis connection failed: ${error.message}`,
      };
    }
  }
}
