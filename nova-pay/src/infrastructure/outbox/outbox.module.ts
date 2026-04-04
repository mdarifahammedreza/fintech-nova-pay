import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from './outbox-event.entity';
import { OutboxRepository } from './outbox.repository';

/**
 * Transactional outbox persistence. Feature modules import this module and call
 * {@link OutboxRepository.enqueueInTransaction} inside their own DB
 * transaction. Does **not** register RabbitMQ — use {@link OutboxRelayModule}
 * in a process that should run the post-commit relay.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  providers: [OutboxRepository],
  exports: [TypeOrmModule, OutboxRepository],
})
export class OutboxModule {}
