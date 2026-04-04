import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PostingService } from '../../ledger/service/posting.service';
import { PaymentOrchestratorService } from '../../payments/service/payment-orchestrator.service';
import { CreatePayrollBatchDto } from '../dto/create-payroll-batch.dto';
import { ProcessPayrollBatchDto } from '../dto/process-payroll-batch.dto';
import { PayrollBatch } from '../entities/payroll-batch.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollService } from './payroll.service';
import { PayrollValidationService } from './payroll-validation.service';

export type CreatePayrollBatchResult = {
  batch: PayrollBatch;
  items: PayrollItem[];
  created: boolean;
};

/**
 * Coordinates validation, funding reservation, per-item execution, and
 * finalization. Uses {@link AccountsService}, {@link PaymentOrchestratorService},
 * and {@link PostingService} only — never sibling repositories.
 */
@Injectable()
export class PayrollOrchestratorService {
  constructor(
    private readonly payroll: PayrollService,
    private readonly validation: PayrollValidationService,
    private readonly payments: PaymentOrchestratorService,
    private readonly posting: PostingService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Idempotent create: returns existing batch+items when idempotency key matches.
   */
  async createPayrollBatch(
    dto: CreatePayrollBatchDto,
  ): Promise<CreatePayrollBatchResult> {
    const existing = await this.payroll.findBatchByEmployerAndIdempotencyKey(
      dto.employerAccountId,
      dto.idempotencyKey,
    );
    if (existing) {
      const items = await this.payroll.listItemsByBatchId(existing.id);
      return { batch: existing, items, created: false };
    }

    await this.validation.assertCreateBatchValid(dto);
    const { batch, items } = await this.payroll.persistNewBatchWithItems(dto);
    // TODO: emit payroll.batch.created via outbox in the same PostgreSQL
    // transaction as persist once OutboxRepository is composed here.
    return { batch, items, created: true };
  }

  /**
   * Reserve employer funds, pay each line, mark batch complete. Partially stubbed.
   */
  async processPayrollBatch(
    batchId: string,
    dto: ProcessPayrollBatchDto,
  ): Promise<PayrollBatch> {
    const { batch, items } = await this.payroll.loadBatchWithItems(batchId);
    this.validation.assertBatchReadyForProcessing(batch, items, dto);
    // TODO: persist process idempotency (dto.idempotencyKey) in payroll-owned table.
    await this.reserveEmployerFunds(batch, items, dto);
    await this.executePayrollItemPayouts(batch, items, dto);
    await this.finalizeProcessedBatch(batch, dto);
    return this.payroll.requireBatchById(batch.id);
  }

  private async reserveEmployerFunds(
    batch: PayrollBatch,
    items: PayrollItem[],
    dto: ProcessPayrollBatchDto,
  ): Promise<void> {
    // TODO: Single TX with PostingService.postWithSharedManager: move funds from
    // employerAccountId to an internal clearing/suspense account; then
    // PayrollService.saveFundingReservation with ledgerTransactionId + POSTED.
    // TODO: outbox payroll.batch.funding_reserved after commit (relay publishes).
    void this.posting;
    void this.dataSource;
    void batch;
    void items;
    void dto;
    throw new Error('PayrollOrchestrator: reserveEmployerFunds not implemented');
  }

  private async executePayrollItemPayouts(
    batch: PayrollBatch,
    items: PayrollItem[],
    dto: ProcessPayrollBatchDto,
  ): Promise<void> {
    // TODO: Chunked worker / cursor-based loop for large batches (resume + backoff).
    // TODO: Per item: build CreatePaymentDto (INTERNAL_TRANSFER or PAYOUT), scope
    // idempotency keys per batch+itemReference; PaymentOrchestratorService.submitPayment;
    // update PayrollItem.paymentId / status via PayrollService in same TX as needed.
    void this.payments;
    void batch;
    void items;
    void dto;
    throw new Error(
      'PayrollOrchestrator: executePayrollItemPayouts not implemented',
    );
  }

  private async finalizeProcessedBatch(
    batch: PayrollBatch,
    dto: ProcessPayrollBatchDto,
  ): Promise<void> {
    // TODO: Verify all items terminal (COMPLETED or FAILED policy); then
    // PayrollService.updateBatchStatus(batch.id, COMPLETED | FAILED).
    // TODO: outbox payroll.batch.completed or payroll.batch.failed.
    void this.payroll;
    void batch;
    void dto;
  }
}
