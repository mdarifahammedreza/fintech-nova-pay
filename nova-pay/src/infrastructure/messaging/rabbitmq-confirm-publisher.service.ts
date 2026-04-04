import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { DomainEventEnvelope } from './rabbitmq.service';

/**
 * Outbox-only publisher using a RabbitMQ **confirm channel** so
 * `waitForConfirms` completes only after the broker has acked the message.
 * Wire shape matches Nest `ClientProxy.emit(pattern, data)`: `{ pattern, data }`.
 */
@Injectable()
export class RabbitmqConfirmPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqConfirmPublisherService.name);
  private connection: amqp.ChannelModel | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close().catch(() => undefined);
    this.connection = null;
  }

  async publishEnvelopeConfirmed(envelope: DomainEventEnvelope): Promise<void> {
    const url = this.config.getOrThrow<string>('RABBITMQ_URL');
    const queue = this.config.get<string>('RABBITMQ_QUEUE', 'nova_pay.events');
    const conn = await this.ensureConnection(url);
    const ch = await conn.createConfirmChannel();
    try {
      await ch.assertQueue(queue, { durable: true });
      const packet = { pattern: envelope.routingKey, data: envelope };
      const body = Buffer.from(JSON.stringify(packet));
      const options: amqp.Options.Publish = {
        persistent: true,
        messageId: envelope.messageId,
        contentType: 'application/json',
      };
      if (envelope.correlationId) {
        options.correlationId = envelope.correlationId;
      }
      ch.sendToQueue(queue, body, options);
      await ch.waitForConfirms();
    } catch (err: unknown) {
      this.logger.error(
        `Confirm publish failed: ${envelope.routingKey} id=${envelope.messageId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    } finally {
      await ch.close().catch(() => undefined);
    }
  }

  private async ensureConnection(url: string): Promise<amqp.ChannelModel> {
    if (this.connection) {
      return this.connection;
    }
    const conn = await amqp.connect(url);
    conn.on('error', (err: Error) => {
      this.logger.warn(`RMQ confirm connection error: ${err.message}`);
      this.connection = null;
    });
    conn.on('close', () => {
      this.connection = null;
    });
    this.connection = conn;
    return conn;
  }
}
