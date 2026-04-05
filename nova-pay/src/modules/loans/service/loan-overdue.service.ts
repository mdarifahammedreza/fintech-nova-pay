import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { LoanOverdueEvent } from '../events/loan-overdue.event';
import { LoanStatus } from '../enums/loan-status.enum';
import { LoanPersistenceService } from './loan-persistence.service';

/**
 * Marks `ACTIVE` loans past `maturityDate` as `OVERDUE` with `loan.overdue`
 * outbox in the same transaction as the status update.
 */
@Injectable()
export class LoanOverdueService {
  private readonly logger = new Logger(LoanOverdueService.name);

  constructor(
    private readonly persistence: LoanPersistenceService,
    private readonly outbox: OutboxRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweepOverdueLoans(): Promise<void> {
    const cutoff = new Date();
    const candidates =
      await this.persistence.findActiveLoansPastMaturity(cutoff);
    for (const c of candidates) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const loan = await this.persistence.lockLoanById(manager, c.id);
          if (!loan || loan.status !== LoanStatus.ACTIVE) {
            return;
          }
          if (
            !loan.maturityDate ||
            loan.maturityDate.getTime() >= cutoff.getTime()
          ) {
            return;
          }
          loan.status = LoanStatus.OVERDUE;
          loan.markedOverdueAt = new Date();
          await this.persistence.persistLoanInTransaction(manager, loan);
          const occurredAt = new Date();
          await this.outbox.enqueueInTransaction(manager, {
            routingKey: OutboxRoutingKey.LOAN_OVERDUE,
            correlationId: loan.id,
            occurredAt,
            payload: new LoanOverdueEvent(
              loan.id,
              loan.maturityDate.toISOString(),
              occurredAt.toISOString(),
            ).toJSON(),
          });
        });
      } catch (e) {
        this.logger.warn(
          `Overdue sweep failed for loan ${c.id}: ${
            e instanceof Error ? e.message : e
          }`,
        );
      }
    }
  }
}
