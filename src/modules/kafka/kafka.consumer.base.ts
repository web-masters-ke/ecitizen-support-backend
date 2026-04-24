import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';

export abstract class BaseKafkaConsumer implements OnModuleDestroy {
  protected abstract readonly logger: Logger;
  protected abstract readonly groupId: string;
  protected abstract readonly topics: string[];
  private consumer: Consumer;

  protected async startConsuming(kafka: Kafka): Promise<void> {
    this.consumer = kafka.consumer({
      groupId: this.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxWaitTimeInMs: 5000,
      retry: { initialRetryTime: 300, retries: 8 },
    });

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topics: this.topics, fromBeginning: false });
      await this.consumer.run({
        autoCommit: true,
        autoCommitInterval: 5000,
        eachMessage: async (payload: EachMessagePayload) => {
          try {
            const raw = payload.message.value?.toString();
            if (!raw) return;
            const data = JSON.parse(raw);
            await this.handleMessage(payload.topic, data, payload.message.key?.toString());
          } catch (err) {
            this.logger.error(`Error processing message on ${payload.topic}: ${(err as Error).message}`);
          }
        },
      });
      this.logger.log(`Consumer [${this.groupId}] subscribed to: ${this.topics.join(', ')}`);
    } catch (err) {
      this.logger.warn(`Consumer [${this.groupId}] failed to start: ${(err as Error).message}`);
    }
  }

  protected abstract handleMessage(topic: string, data: unknown, key?: string): Promise<void>;

  async onModuleDestroy() {
    await this.consumer?.disconnect().catch(() => null);
  }
}
