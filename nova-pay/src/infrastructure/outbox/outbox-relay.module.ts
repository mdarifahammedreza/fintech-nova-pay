import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { RabbitmqModule } from '../messaging/rabbitmq.module';
import { OutboxModule } from './outbox.module';
import { OutboxProcessorService } from './outbox-processor.service';
import { OutboxRelayCronService } from './outbox-relay-cron.service';

/**
 * Post-commit RabbitMQ relay + cron tick. Requires `RABBITMQ_URL`. Uses
 * {@link ScheduleModule} for `relayPendingBatch`; set `OUTBOX_RELAY_ENABLED=false`
 * to disable the timer (e.g. dedicated worker process calls the processor).
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    OutboxModule,
    RabbitmqModule,
  ],
  providers: [OutboxProcessorService, OutboxRelayCronService],
  exports: [OutboxProcessorService],
})
export class OutboxRelayModule {}
