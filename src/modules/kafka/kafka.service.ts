import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, CompressionTypes, logLevel } from 'kafkajs';
import { KafkaTopic } from './kafka.topics';

export interface KafkaMessage<T = unknown> {
  topic: KafkaTopic;
  key?: string;
  value: T;
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private connected = false;

  constructor(private readonly config: ConfigService) {
    this.kafka = new Kafka({
      clientId: this.config.get('KAFKA_CLIENT_ID', 'ecitizen-scc'),
      brokers: this.config.get('KAFKA_BROKERS', 'localhost:9094').split(','),
      connectionTimeout: 10000,
      requestTimeout: 30000,
      logLevel: logLevel.WARN,
      retry: { initialRetryTime: 300, retries: 10 },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
      idempotent: true,
      maxInFlightRequests: 5,
    });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.connected = true;
      this.logger.log('Kafka producer connected');
    } catch (err) {
      // Non-fatal — app still works without Kafka (graceful degradation)
      this.logger.warn(`Kafka producer failed to connect: ${(err as Error).message}. Events will be skipped.`);
    }
  }

  async onModuleDestroy() {
    if (this.connected) await this.producer.disconnect();
  }

  async publish<T>(message: KafkaMessage<T>): Promise<void> {
    if (!this.connected) {
      this.logger.warn(`Kafka not connected — skipping event on ${message.topic}`);
      return;
    }
    try {
      await this.producer.send({
        topic: message.topic,
        compression: CompressionTypes.GZIP,
        messages: [{
          key: message.key ?? null,
          value: JSON.stringify({ ...message.value as object, _publishedAt: new Date().toISOString() }),
        }],
      });
    } catch (err) {
      this.logger.error(`Failed to publish to ${message.topic}: ${(err as Error).message}`);
    }
  }

  async publishBatch<T>(messages: KafkaMessage<T>[]): Promise<void> {
    if (!this.connected || messages.length === 0) return;
    try {
      const grouped = messages.reduce<Record<string, typeof messages>>((acc, msg) => {
        (acc[msg.topic] ??= []).push(msg);
        return acc;
      }, {});

      await this.producer.sendBatch({
        compression: CompressionTypes.GZIP,
        topicMessages: Object.entries(grouped).map(([topic, msgs]) => ({
          topic,
          messages: msgs.map(m => ({
            key: m.key ?? null,
            value: JSON.stringify({ ...m.value as object, _publishedAt: new Date().toISOString() }),
          })),
        })),
      });
    } catch (err) {
      this.logger.error(`Batch publish failed: ${(err as Error).message}`);
    }
  }

  getKafkaInstance(): Kafka {
    return this.kafka;
  }
}
