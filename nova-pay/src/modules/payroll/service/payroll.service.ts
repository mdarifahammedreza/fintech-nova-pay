import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { CreatePayrollBatchDto } from '../dto/create-payroll-batch.dto';
import { QueryPayrollBatchDto } from '../dto/query-payroll-batch.dto';
import { PayrollBatch } from '../entities/payroll-batch.entity';
import { PayrollFundingReservation } from '../entities/payroll-funding-reservation.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollBatchStatus } from '../enums/payroll-batch-status.enum';
import { PayrollItemStatus } from '../enums/payroll-item-status.enum';
import { PayrollBatchRepository } from '../repositories/payroll-batch.repository';
import { PayrollFundingReservationRepository } from '../repositories/payroll-funding-reservation.repository';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollBatchCreatedEvent } from '../events/payroll-batch-created.event';

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
