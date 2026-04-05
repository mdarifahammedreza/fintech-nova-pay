import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Currency } from '../../accounts/enums/currency.enum';
import { PostLedgerTransactionDto } from '../../ledger/dto/post-ledger-transaction.dto';
import { LedgerEntryType } from '../../ledger/enums/ledger-entry-type.enum';
import { LedgerTransactionType } from '../../ledger/enums/ledger-transaction-type.enum';
import { PostingService } from '../../ledger/service/posting.service';
import { CreatePayrollBatchDto } from '../dto/create-payroll-batch.dto';
import { ProcessPayrollBatchDto } from '../dto/process-payroll-batch.dto';
import { PayrollBatch } from '../entities/payroll-batch.entity';
import { PayrollFundingReservation } from '../entities/payroll-funding-reservation.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollBatchStatus } from '../enums/payroll-batch-status.enum';
import { PayrollItemStatus } from '../enums/payroll-item-status.enum';
import { PayrollEmployerFundingLockService } from './payroll-employer-funding-lock.service';
import { PayrollService } from './payroll.service';
import { PayrollValidationService } from './payroll-validation.service';

export type CreatePayrollBatchResult = {
  batch: PayrollBatch;
  items: PayrollItem[];
  created: boolean;
};

const LEDGER_MEMO_MAX = 512;

/**
 * Coordinates validation, funding reservation, per-item execution, and
 * finalization. Uses {@link PostingService} for all money movement — never
 * sibling repositories or direct ledger tables.
 *
 * Employer debits for funding are serialized per employer account via
 * {@link PayrollEmployerFundingLockService} inside the funding transaction.
 */
@Injectable()
export class PayrollOrchestratorService {
  constructor(
    private readonly payroll: PayrollService,
    private readonly validation: PayrollValidationService,
    private readonly posting: PostingService,
    private readonly employerFundingLock: PayrollEmployerFundingLockService,
    private readonly config: ConfigService,
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
    return { batch, items, created: true };
  }

  /**
   * Reserve employer → clearing once, then fan out clearing → employees.
   * Resumable when status is DISBURSING (skips funding and completed lines).
   */
  async processPayrollBatch(
    batchId: string,
    dto: ProcessPayrollBatchDto,
  ): Promise<PayrollBatch> {
    const { batch: initialBatch } =
      await this.payroll.loadBatchWithItems(batchId);
    let reservation =
      await this.payroll.getFundingReservationByBatchId(batchId);

    if (initialBatch.status === PayrollBatchStatus.COMPLETED) {
      return initialBatch;
    }
    if (
      initialBatch.status === PayrollBatchStatus.FAILED ||
      initialBatch.status === PayrollBatchStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Payroll batch ${batchId} cannot be processed in status ${initialBatch.status}`,
      );
    }

    let items = await this.payroll.listItemsByBatchId(batchId);

    if (initialBatch.status === PayrollBatchStatus.DRAFT) {
      this.validation.assertBatchReadyForProcessing(
        initialBatch,
        items,
        dto,
      );
      try {
        await this.reserveEmployerFunds(initialBatch, dto);
      } catch (e) {
        await this.payroll.markBatchFundingFailed(batchId, dto, e);
        throw e;
      }
      await this.payroll.updateBatchStatus(
        batchId,
        PayrollBatchStatus.DISBURSING,
      );
    } else if (initialBatch.status === PayrollBatchStatus.FUNDING_RESERVED) {
      if (!reservation || reservation.reservationStatus !== 'POSTED') {
        throw new BadRequestException(
          'Batch is FUNDING_RESERVED without a posted reservation',
        );
      }
      await this.payroll.updateBatchStatus(
        batchId,
        PayrollBatchStatus.DISBURSING,
      );
    } else if (initialBatch.status === PayrollBatchStatus.DISBURSING) {
      this.validation.assertDisbursingResume(
        initialBatch,
        reservation,
        items,
      );
    } else {
      throw new BadRequestException(
        `Payroll batch ${batchId} status ${initialBatch.status} cannot be processed`,
      );
    }

    reservation = await this.payroll.getFundingReservationByBatchId(batchId);
    if (!reservation || reservation.reservationStatus !== 'POSTED') {
      throw new BadRequestException(
        'Payroll batch is missing posted employer funding',
      );
    }

    const batch = await this.payroll.requireBatchById(batchId);
    items = await this.payroll.listItemsByBatchId(batchId);

    await this.executePayrollItemPayouts(batch, items, dto);
    await this.payroll.finalizePayrollBatchAfterDisbursement(batchId, dto);
    return this.payroll.requireBatchById(batchId);
  }

  private clearingAccountId(currency: Currency): string {
    const key = `PAYROLL_CLEARING_ACCOUNT_${currency}`;
    const raw = this.config.get<string>(key);
    if (raw == null || raw.trim() === '') {
      throw new BadRequestException(
        `Payroll clearing is not configured (${key})`,
      );
    }
    return raw.trim();
  }

  private async reserveEmployerFunds(
    batch: PayrollBatch,
    dto: ProcessPayrollBatchDto,
  ): Promise<void> {
    const clearingId = this.clearingAccountId(batch.currency);
    const fundCorrelation = `pr:f:${batch.id}`;
    await this.dataSource.transaction(async (manager) => {
      const lockedBatch = await manager.findOne(PayrollBatch, {
        where: { id: batch.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedBatch) {
        throw new NotFoundException('Payroll batch not found');
      }
      if (lockedBatch.status !== PayrollBatchStatus.DRAFT) {
        return;
      }

      let resRow = await manager.findOne(PayrollFundingReservation, {
        where: { batch: { id: batch.id } },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        resRow?.reservationStatus === 'POSTED' &&
        resRow.ledgerTransactionId
      ) {
        await manager.update(
          PayrollBatch,
          { id: batch.id },
          { status: PayrollBatchStatus.FUNDING_RESERVED },
        );
        return;
      }

      await this.employerFundingLock.assertTransactionScopedEmployerLock(
        manager,
        lockedBatch.employerAccountId,
      );

      const memo = (dto.memo ?? `Payroll fund ${lockedBatch.reference}`).slice(
        0,
        LEDGER_MEMO_MAX,
      );
      const postDto: PostLedgerTransactionDto = {
        type: LedgerTransactionType.TRANSFER,
        correlationId: fundCorrelation,
        memo,
        entries: [
          {
            accountId: lockedBatch.employerAccountId,
            entryType: LedgerEntryType.DEBIT,
            amount: lockedBatch.totalAmount,
            currency: lockedBatch.currency,
          },
          {
            accountId: clearingId,
            entryType: LedgerEntryType.CREDIT,
            amount: lockedBatch.totalAmount,
            currency: lockedBatch.currency,
          },
        ],
      };
      const lt = await this.posting.postWithSharedManager(manager, postDto);

      if (!resRow) {
        resRow = manager.create(PayrollFundingReservation, {
          batch: lockedBatch,
          reservedAmount: lockedBatch.totalAmount,
          currency: lockedBatch.currency,
          ledgerTransactionId: lt.id,
          reservationStatus: 'POSTED',
        });
      } else {
        resRow.ledgerTransactionId = lt.id;
        resRow.reservationStatus = 'POSTED';
        resRow.reservedAmount = lockedBatch.totalAmount;
        resRow.currency = lockedBatch.currency;
      }
      const savedRes = await manager.save(PayrollFundingReservation, resRow);
      await manager.update(
        PayrollBatch,
        { id: batch.id },
        { status: PayrollBatchStatus.FUNDING_RESERVED },
      );
      const occurredAt = new Date();
      await this.payroll.enqueuePayrollBatchFundedInTransaction(
        manager,
        lockedBatch,
        savedRes,
        lt.id,
        dto,
        occurredAt,
      );
    });
  }

  private async executePayrollItemPayouts(
    batch: PayrollBatch,
    items: PayrollItem[],
    dto: ProcessPayrollBatchDto,
  ): Promise<void> {
    const clearingId = this.clearingAccountId(batch.currency);
    for (const item of items) {
      if (item.status !== PayrollItemStatus.PENDING) {
        continue;
      }
      try {
        await this.dataSource.transaction(async (manager) => {
          const row = await manager.findOne(PayrollItem, {
            where: { id: item.id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!row || row.status !== PayrollItemStatus.PENDING) {
            return;
          }
          const header = await manager.findOne(PayrollBatch, {
            where: { id: batch.id },
          });
          if (!header) {
            throw new NotFoundException('Payroll batch not found');
          }
          const lineCorrelation = `pr:i:${row.id}`;
          const lineMemo =
            `Payroll ${header.reference} line ${row.itemReference}`.slice(
              0,
              LEDGER_MEMO_MAX,
            );
          const postDto: PostLedgerTransactionDto = {
            type: LedgerTransactionType.TRANSFER,
            correlationId: lineCorrelation,
            memo: lineMemo,
            entries: [
              {
                accountId: clearingId,
                entryType: LedgerEntryType.DEBIT,
                amount: row.amount,
                currency: row.currency,
              },
              {
                accountId: row.employeeAccountId,
                entryType: LedgerEntryType.CREDIT,
                amount: row.amount,
                currency: row.currency,
              },
            ],
          };
          const lt = await this.posting.postWithSharedManager(
            manager,
            postDto,
          );
          row.status = PayrollItemStatus.COMPLETED;
          row.ledgerTransactionId = lt.id;
          await manager.save(PayrollItem, row);
          const occurredAt = new Date();
          await this.payroll.enqueuePayrollItemCompletedInTransaction(
            manager,
            header,
            row,
            lt.id,
            dto,
            occurredAt,
          );
        });
      } catch (err) {
        await this.payroll.markItemPayoutFailed(item.id, err);
      }
    }
  }
}
