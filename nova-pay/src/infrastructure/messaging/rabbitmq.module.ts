import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  ClientsModule,
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import {
  RABBITMQ_CLIENT,
  RabbitmqService,
} from './rabbitmq.service';

/**
 * Outbound RMQ client for async domain notifications.
 *
 * TODO: Connect **outbox publisher** (infrastructure or ledger module) to
 * `RabbitmqService` **after** PostgreSQL commit — never before.
 *
 * TODO: Inbound consumers: `app.connectMicroservice(createRmqInboundOptions(
 *   config))` then `startAllMicroservices()` in `main.ts`, plus
 * `@EventPattern()` handlers under `messaging/consumers/`.
 *
 * Do **not** publish domain events directly from controllers.
 */
@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.getOrThrow<string>('RABBITMQ_URL')],
            queue: config.get<string>('RABBITMQ_QUEUE', 'nova_pay.events'),
            queueOptions: { durable: true },
            persistent: true,
            socketOptions: {
              heartbeatIntervalInSeconds: 60,
              reconnectTimeInSeconds: 5,
            },
          },
        }),
      },
    ]),
  ],
  providers: [RabbitmqService],
  exports: [ClientsModule, RabbitmqService],
})
export class RabbitmqModule {}

/**
 * Options for **inbound** domain-event consumers (separate bootstrap hook).
 * Extend `messaging/consumers/*` with `@EventPattern(routingKey)`.
 */
export function createRmqInboundMicroserviceOptions(
  config: ConfigService,
): MicroserviceOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [config.getOrThrow<string>('RABBITMQ_URL')],
      queue: config.get<string>(
        'RABBITMQ_CONSUMER_QUEUE',
        'nova_pay.consumers',
      ),
      queueOptions: { durable: true },
      noAck: false,
      prefetchCount: Number(config.get<string>('RABBITMQ_PREFETCH', '10')),
    },
  };
}
