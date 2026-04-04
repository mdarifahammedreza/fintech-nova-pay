import { Module } from '@nestjs/common';
import { RabbitmqModule } from '../messaging/rabbitmq.module';
import { OutboxModule } from './outbox.module';
import { OutboxProcessorService } from './outbox-processor.service';

/**
 * Post-commit RabbitMQ relay. Import alongside {@link OutboxModule} only in
 * deployments where `RABBITMQ_URL` is configured (worker or API, as you prefer).
 */
@Module({
  imports: [OutboxModule, RabbitmqModule],
  providers: [OutboxProcessorService],
  exports: [OutboxProcessorService],
})
export class OutboxRelayModule {}
