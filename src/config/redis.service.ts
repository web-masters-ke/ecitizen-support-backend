import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');
    const db = this.configService.get<number>('REDIS_DB', 0);

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      db,
      retryStrategy: (times: number) => {
        if (times > 3) {
          this.logger.error(
            `Redis connection failed after ${times} attempts. Giving up.`,
          );
          return null;
        }
        const delay = Math.min(times * 200, 2000);
        this.logger.warn(
          `Redis connection attempt ${times} failed. Retrying in ${delay}ms...`,
        );
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to Redis at ${host}:${port}`);
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn(
        `Redis not available - running without cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      this.logger.log('Disconnecting from Redis...');
      await this.client.quit();
      this.logger.log('Successfully disconnected from Redis');
    }
  }

  /**
   * Returns the underlying ioredis client instance.
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Health check - useful for readiness probes.
   */
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.client) return false;
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------------
  // String operations
  // ----------------------------------------------------------------

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.warn(
        `Redis SET failed for key "${key}": ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(
        `Redis DEL failed for key "${key}": ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  // ----------------------------------------------------------------
  // Hash operations
  // ----------------------------------------------------------------

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    await this.client.hdel(key, ...fields);
  }

  // ----------------------------------------------------------------
  // JSON convenience methods
  // ----------------------------------------------------------------

  /**
   * Set a JSON-serializable value with optional TTL.
   */
  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  /**
   * Get and parse a JSON value.
   */
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  // ----------------------------------------------------------------
  // Pattern-based operations
  // ----------------------------------------------------------------

  /**
   * Delete keys matching a glob pattern.
   * Uses SCAN to avoid blocking the server.
   */
  async deleteByPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await this.client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    return deletedCount;
  }
}
