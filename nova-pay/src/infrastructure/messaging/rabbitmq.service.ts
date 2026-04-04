import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT';

/**
 * Async domain-event transport only. PostgreSQL + outbox own truth.
 *
 * Do **not** call from HTTP controllers. After commit, the **outbox
 * publisher** (TODO) should dispatch rows via `publish$` / `publishAndLog`.
 */
export type DomainEventEnvelope = {
  routingKey: string;
  payload: Readonly<Record<string, unknown>>;
  correlationId?: string;
  causationId?: string;
  messageId?: string;
  occurredAt: string;
};

/**
 * Structural hint for classes under `infrastructure/messaging/consumers/`.
 * Use `@EventPattern()` when the app enables inbound RMQ microservices.
 */
export interface RmqConsumerRegistration {
  readonly patterns: readonly string[];
}

@Injectable()
export class RabbitmqService {
  private readonly logger = new Logger(RabbitmqService.name);

  constructor(
    @Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy,
  ) {}

  /**
   * Cold Observable — subscribe or use `publishAndLog` for fire-and-forget.
   * Outbox relay awaits this Observable before marking a row published.
   */
  publish$(envelope: DomainEventEnvelope): Observable<void> {
    return this.client.emit(envelope.routingKey, envelope).pipe(
      tap({
        error: (err: unknown) =>
          this.logger.error(
            `RMQ emit failed: ${envelope.routingKey}`,
            err instanceof Error ? err.stack : String(err),
          ),
      }),
      catchError((err: unknown) => throwError(() => err)),
    );
  }

  /**
   * Fire-and-forget with logging (typical outbox relay path).
   */
  publishAndLog(envelope: DomainEventEnvelope): void {
    this.publish$(envelope).subscribe({
      error: () => {
        /* logged in publish$ */
      },
    });
  }
}
