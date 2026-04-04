import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitmqModule } from '../messaging/rabbitmq.module';
import { OutboxEvent } from './outbox-event.entity';
import { OutboxProcessorService } from './outbox-processor.service';
import { OutboxRepository } from './outbox.repository';

/**
 * Transactional outbox (PostgreSQL) + post-commit RabbitMQ relay.
 * Feature modules import this module to inject {@link OutboxRepository} and
 * call {@link OutboxRepository.enqueueInTransaction} inside their own TX.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent]), RabbitmqModule],
  providers: [OutboxRepository, OutboxProcessorService],
  exports: [OutboxRepository, OutboxProcessorService],
})
export class OutboxModule {}
