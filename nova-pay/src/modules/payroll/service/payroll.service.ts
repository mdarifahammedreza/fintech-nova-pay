import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { CreatePayrollBatchDto } from '../dto/create-payroll-batch.dto';
import { ProcessPayrollBatchDto } from '../dto/process-payroll-batch.dto';
import { QueryPayrollBatchDto } from '../dto/query-payroll-batch.dto';
import { PayrollBatch } from '../entities/payroll-batch.entity';
import { PayrollFundingReservation } from '../entities/payroll-funding-reservation.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollBatchStatus } from '../enums/payroll-batch-status.enum';
import { PayrollItemStatus } from '../enums/payroll-item-status.enum';
import { PayrollBatchRepository } from '../repositories/payroll-batch.repository';
import { PayrollFundingReservationRepository } from '../repositories/payroll-funding-reservation.repository';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollBatchCompletedEvent } from '../events/payroll-batch-completed.event';
import { PayrollBatchCreatedEvent } from '../events/payroll-batch-created.event';
import { PayrollBatchFailedEvent } from '../events/payroll-batch-failed.event';
import { PayrollBatchFundedEvent } from '../events/payroll-batch-funded.event';
import { PayrollItemCompletedEvent } from '../events/payroll-item-completed.event';

/**
 * Payroll persistence and aggregate loading — no cross-module money calls.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly batchRepo: PayrollBatchRepository,
    private readonly itemRepo: PayrollItemRepository,
    private readonly fundingRepo: PayrollFundingReservationRepository,
    private readonly outbox: OutboxRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findBatchByEmployerAndIdempotencyKey(
    employerAccountId: string,
    idempotencyKey: string,
  ): Promise<PayrollBatch | null> {
    return this.batchRepo.findByEmployerAndIdempotencyKey(
      employerAccountId,
      idempotencyKey,
    );
  }

  getBatchById(id: string): Promise<PayrollBatch | null> {
    return this.batchRepo.findById(id);
  }

  async requireBatchById(id: string): Promise<PayrollBatch> {
    const row = await this.batchRepo.findById(id);
    if (!row) {
      throw new NotFoundException('Payroll batch not found');
    }
    return row;
  }

  listItemsByBatchId(batchId: string): Promise<PayrollItem[]> {
    return this.itemRepo.findByBatchId(batchId);
  }

  async loadBatchWithItems(
    batchId: string,
  ): Promise<{ batch: PayrollBatch; items: PayrollItem[] }> {
    const batch = await this.requireBatchById(batchId);
    const items = await this.listItemsByBatchId(batchId);
    return { batch, items };
  }

  /**
   * Inserts batch header + items in one transaction.
   */
  async persistNewBatchWithItems(
    dto: CreatePayrollBatchDto,
  ): Promise<{ batch: PayrollBatch; items: PayrollItem[] }> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const batchEntity = manager.create(PayrollBatch, {
        employerAccountId: dto.employerAccountId,
        totalAmount: dto.totalAmount,
        currency: dto.currency,
        status: PayrollBatchStatus.DRAFT,
        reference: dto.reference,
        idempotencyKey: dto.idempotencyKey,
        correlationId: dto.correlationId ?? null,
        externalBatchRef: dto.externalBatchRef ?? null,
        memo: dto.memo ?? null,
      });
      const batch = await manager.save(PayrollBatch, batchEntity);

      const itemRows = dto.items.map((line) =>
        manager.create(PayrollItem, {
          batch,
          employeeAccountId: line.employeeAccountId,
          amount: line.amount,
          currency: line.currency,
          status: PayrollItemStatus.PENDING,
          itemReference: line.itemReference,
          paymentId: null,
          ledgerTransactionId: null,
          memo: line.memo ?? null,
        }),
      );
      const items = await manager.save(PayrollItem, itemRows);
      const occurredAt = new Date();
      const evt = new PayrollBatchCreatedEvent(
        batch.id,
        batch.employerAccountId,
        batch.reference,
        batch.idempotencyKey,
        batch.correlationId,
        batch.externalBatchRef,
        batch.totalAmount,
        batch.currency,
        items.length,
        occurredAt.toISOString(),
      );
      await this.outbox.enqueueInTransaction(manager, {
        routingKey: OutboxRoutingKey.PAYROLL_BATCH_CREATED,
        correlationId: batch.correlationId,
        occurredAt,
        payload: evt.toJSON(),
      });
      return { batch, items };
    });
  }

  async updateBatchStatus(
    batchId: string,
    status: PayrollBatchStatus,
  ): Promise<void> {
    await this.batchRepo.update({ id: batchId }, { status });
  }

  async saveFundingReservation(
    row: PayrollFundingReservation,
  ): Promise<PayrollFundingReservation> {
    return this.fundingRepo.save(row);
  }

  getFundingReservationByBatchId(
    batchId: string,
  ): Promise<PayrollFundingReservation | null> {
    return this.fundingRepo.findByBatchId(batchId);
  }

  listItemsByBatchManaged(
    manager: EntityManager,
    batchId: string,
  ): Promise<PayrollItem[]> {
    return manager.find(PayrollItem, {
      where: { batch: { id: batchId } },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Marks a line FAILED after a payout attempt error (separate TX so partial
   * failure is visible even when the payout TX rolled back).
   */
  /**
   * Terminal failure before disbursement (e.g. ledger rejected funding).
   * No-op if the batch is no longer DRAFT.
   */
  async markBatchFundingFailed(
    batchId: string,
    dto: ProcessPayrollBatchDto,
    err: unknown,
  ): Promise<void> {
    const message = (
      err instanceof Error ? err.message : String(err)
    ).slice(0, 512);
    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(PayrollBatch, {
        where: { id: batchId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status !== PayrollBatchStatus.DRAFT) {
        return;
      }
      await manager.update(
        PayrollBatch,
        { id: batchId },
        { status: PayrollBatchStatus.FAILED },
      );
      const occurredAt = new Date();
      const corr =
        dto.correlationId ?? locked.correlationId ?? dto.idempotencyKey;
      const evt = new PayrollBatchFailedEvent(
        locked.id,
        locked.employerAccountId,
        locked.reference,
        dto.idempotencyKey,
        dto.correlationId ?? locked.correlationId,
        'FUNDING_REJECTED',
        message,
        occurredAt.toISOString(),
      );
      await this.outbox.enqueueInTransaction(manager, {
        routingKey: OutboxRoutingKey.PAYROLL_BATCH_FAILED,
        correlationId: corr,
        occurredAt,
        payload: evt.toJSON(),
      });
    });
  }

  async markItemPayoutFailed(itemId: string, err: unknown): Promise<void> {
    const message =
      err instanceof Error ? err.message : String(err);
    const truncated = message.slice(0, 512);
    await this.dataSource.transaction(async (manager) => {
      const row = await manager.findOne(PayrollItem, {
        where: { id: itemId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row || row.status !== PayrollItemStatus.PENDING) {
        return;
      }
      row.status = PayrollItemStatus.FAILED;
      row.memo = truncated;
      await manager.save(PayrollItem, row);
    });
  }

  /**
   * After all lines are terminal, set COMPLETED or FAILED and emit batch outbox.
   */
  async finalizePayrollBatchAfterDisbursement(
    batchId: string,
    dto: ProcessPayrollBatchDto,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(PayrollBatch, {
        where: { id: batchId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status !== PayrollBatchStatus.DISBURSING) {
        return;
      }
      const items = await this.listItemsByBatchManaged(manager, batchId);
      if (
        items.some((i) => i.status === PayrollItemStatus.PENDING)
      ) {
        return;
      }
      const allTerminal = items.every(
        (i) =>
          i.status === PayrollItemStatus.COMPLETED ||
          i.status === PayrollItemStatus.FAILED,
      );
      if (!allTerminal) {
        return;
      }
      const failed = items.some(
        (i) => i.status === PayrollItemStatus.FAILED,
      );
      const occurredAt = new Date();
      const corr =
        dto.correlationId ?? locked.correlationId ?? dto.idempotencyKey;
      if (failed) {
        await manager.update(
          PayrollBatch,
          { id: batchId },
          { status: PayrollBatchStatus.FAILED },
        );
        const { reasonCode, message } = firstPayrollFailureSummary(items);
        const evt = new PayrollBatchFailedEvent(
          locked.id,
          locked.employerAccountId,
          locked.reference,
          dto.idempotencyKey,
          dto.correlationId ?? locked.correlationId,
          reasonCode,
          message,
          occurredAt.toISOString(),
        );
        await this.outbox.enqueueInTransaction(manager, {
          routingKey: OutboxRoutingKey.PAYROLL_BATCH_FAILED,
          correlationId: corr,
          occurredAt,
          payload: evt.toJSON(),
        });
        return;
      }
      await manager.update(
        PayrollBatch,
        { id: batchId },
        { status: PayrollBatchStatus.COMPLETED },
      );
      const completedCount = items.filter(
        (i) => i.status === PayrollItemStatus.COMPLETED,
      ).length;
      const completedEvt = new PayrollBatchCompletedEvent(
        locked.id,
        locked.employerAccountId,
        locked.reference,
        dto.idempotencyKey,
        dto.correlationId ?? locked.correlationId,
        locked.totalAmount,
        locked.currency,
        completedCount,
        occurredAt.toISOString(),
      );
      await this.outbox.enqueueInTransaction(manager, {
        routingKey: OutboxRoutingKey.PAYROLL_BATCH_COMPLETED,
        correlationId: corr,
        occurredAt,
        payload: completedEvt.toJSON(),
      });
    });
  }

  enqueuePayrollBatchFundedInTransaction(
    manager: EntityManager,
    batch: PayrollBatch,
    reservation: PayrollFundingReservation,
    ledgerTransactionId: string,
    processDto: ProcessPayrollBatchDto,
    occurredAt: Date,
  ): Promise<unknown> {
    const corr =
      processDto.correlationId ??
      batch.correlationId ??
      processDto.idempotencyKey;
    const evt = new PayrollBatchFundedEvent(
      batch.id,
      batch.employerAccountId,
      batch.reference,
      batch.correlationId,
      reservation.id,
      ledgerTransactionId,
      reservation.reservedAmount,
      reservation.currency,
      occurredAt.toISOString(),
    );
    return this.outbox.enqueueInTransaction(manager, {
      routingKey: OutboxRoutingKey.PAYROLL_BATCH_FUNDED,
      correlationId: corr,
      occurredAt,
      payload: evt.toJSON(),
    });
  }

  enqueuePayrollItemCompletedInTransaction(
    manager: EntityManager,
    batch: PayrollBatch,
    item: PayrollItem,
    ledgerTransactionId: string,
    processDto: ProcessPayrollBatchDto,
    occurredAt: Date,
  ): Promise<unknown> {
    const corr =
      processDto.correlationId ??
      batch.correlationId ??
      processDto.idempotencyKey;
    const evt = new PayrollItemCompletedEvent(
      batch.id,
      item.id,
      item.itemReference,
      item.employeeAccountId,
      batch.reference,
      batch.correlationId,
      null,
      ledgerTransactionId,
      item.amount,
      item.currency,
      occurredAt.toISOString(),
    );
    return this.outbox.enqueueInTransaction(manager, {
      routingKey: OutboxRoutingKey.PAYROLL_ITEM_COMPLETED,
      correlationId: corr,
      occurredAt,
      payload: evt.toJSON(),
    });
  }

  /**
   * Paginated listing for read APIs (offset from page/limit).
   */
  async listBatches(
    query: QueryPayrollBatchDto,
  ): Promise<{ rows: PayrollBatch[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (query.employerAccountId) {
      where.employerAccountId = query.employerAccountId;
    }
    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.reference !== undefined) {
      where.reference = query.reference;
    }
    const [rows, total] = await this.batchRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return { rows, total };
  }
}

function firstPayrollFailureSummary(items: PayrollItem[]): {
  reasonCode: string;
  message: string;
} {
  const failed = items.find((i) => i.status === PayrollItemStatus.FAILED);
  return {
    reasonCode: 'PARTIAL_DISBURSEMENT',
    message: failed?.memo ?? 'One or more payroll lines failed',
  };
}
