import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
} from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { Account } from '../../accounts/entities/account.entity';
import { AccountStatus } from '../../accounts/enums/account-status.enum';
import { PostLedgerTransactionDto } from '../../ledger/dto/post-ledger-transaction.dto';
import { LedgerEntryType } from '../../ledger/enums/ledger-entry-type.enum';
import { LedgerTransactionType } from '../../ledger/enums/ledger-transaction-type.enum';
import { PostingService } from '../../ledger/service/posting.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import {
  IdempotencyRecord,
  IdempotencyRecordStatus,
} from '../entities/idempotency-record.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentType } from '../enums/payment-type.enum';
import { IdempotencyRecordRepository } from '../repositories/idempotency-record.repository';

/**
 * Coordinates payment intent → account checks → ledger post → payment outcome
 * using {@link PostingService} and the shared `DataSource` transaction only.
 *
 * ## Money-path transaction (NovaPay architecture)
 *
 * `submitPayment` runs idempotency resolution, payment `PROCESSING`, ledger post
 * (header + entries + account projections), and terminal payment + idempotency
 * updates in **one** PostgreSQL transaction via `DataSource.transaction`.
 *
 * **Idempotency:** `resolveIdempotencySlot` uses `FOR UPDATE` + DB unique on
 * `(idempotency_key, scope_key)` under the same `EntityManager`; races reload
 * and return the same payment row.
 *
 * TODO: **Fraud** — synchronous policy checks before ledger with locks held.
 *
 * Outbox: {@link OutboxRepository.enqueueInTransaction} for `payment.completed`
 * or `payment.failed` in the same TX as terminal payment + idempotency state.
 * Ledger events are written inside {@link PostingService.postWithSharedManager}.
 *
 * **Failure path:** after a ledger error, FAILED rows and `payment.failed` are
 * saved and the callback **returns** the payment (no `throw`) so TypeORM
 * commits; callers map `FAILED` to HTTP.
 */
@Injectable()
export class PaymentOrchestratorService {
  constructor(
    private readonly posting: PostingService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly idempotencyRepo: IdempotencyRecordRepository,
    private readonly outbox: OutboxRepository,
  ) {}

  /**
   * Executes an internal money movement backed by a ledger post.
   * Retries with the same idempotency key return the same {@link Payment}
   * row (completed or failed) without executing the ledger path again.
   */
  async submitPayment(dto: CreatePaymentDto): Promise<Payment> {
    const scopeKey = dto.idempotencyScopeKey ?? '';
    const fingerprint = fingerprintCreatePayment(dto);

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const { idempotencyRecord, payment } =
        await this.resolveIdempotencySlot(
          manager,
          dto,
          scopeKey,
          fingerprint,
        );

      if (payment.status === PaymentStatus.COMPLETED) {
        return payment;
      }
      if (payment.status === PaymentStatus.FAILED) {
        return payment;
      }

      const source = await manager.findOne(Account, {
        where: { id: dto.sourceAccountId },
      });
      const dest = await manager.findOne(Account, {
        where: { id: dto.destinationAccountId },
      });
      if (!source) {
        throw new NotFoundException('Source account not found');
      }
      if (!dest) {
        throw new NotFoundException('Destination account not found');
      }
      this.assertAccountsReady(source, dest, dto);

      payment.status = PaymentStatus.PROCESSING;
      await manager.save(Payment, payment);

      const ledgerDto = this.buildLedgerPostDto(dto, payment.id);

      try {
        const ledgerTx = await this.posting.postWithSharedManager(
          manager,
          ledgerDto,
        );
        payment.status = PaymentStatus.COMPLETED;
        payment.ledgerTransactionId = ledgerTx.id;
        idempotencyRecord.status = IdempotencyRecordStatus.COMPLETED;
        await manager.save(IdempotencyRecord, idempotencyRecord);
        await this.outbox.enqueueInTransaction(manager, {
          routingKey: OutboxRoutingKey.PAYMENT_COMPLETED,
          correlationId: payment.correlationId ?? dto.correlationId ?? null,
          occurredAt: new Date(),
          payload: {
            paymentId: payment.id,
            reference: payment.reference,
            ledgerTransactionId: ledgerTx.id,
            amount: payment.amount,
            currency: payment.currency,
            type: payment.type,
          },
        });
        return manager.save(Payment, payment);
      } catch (err: unknown) {
        payment.status = PaymentStatus.FAILED;
        idempotencyRecord.status = IdempotencyRecordStatus.FAILED;
        await manager.save(IdempotencyRecord, idempotencyRecord);
        await this.outbox.enqueueInTransaction(manager, {
          routingKey: OutboxRoutingKey.PAYMENT_FAILED,
          correlationId: payment.correlationId ?? dto.correlationId ?? null,
          occurredAt: new Date(),
          payload: {
            paymentId: payment.id,
            reference: payment.reference,
            amount: payment.amount,
            currency: payment.currency,
            type: payment.type,
            reason:
              err instanceof Error ? err.message : String(err),
          },
        });
        return manager.save(Payment, payment);
      }
    });
  }

  /**
   * Lock or create idempotency row, materialize payment, fingerprint rules.
   * Unique violations → load winner and return same outcome (same request → same
   * result). Must run on the caller’s `EntityManager` (money transaction).
   */
  private async resolveIdempotencySlot(
    manager: EntityManager,
    dto: CreatePaymentDto,
    scopeKey: string,
    fingerprint: string,
  ): Promise<{ idempotencyRecord: IdempotencyRecord; payment: Payment }> {
    let record = await this.idempotencyRepo.findByIdempotencyKeyForUpdate(
      manager,
      dto.idempotencyKey,
      scopeKey,
    );

    if (
      record?.requestFingerprint &&
      record.requestFingerprint !== fingerprint
    ) {
      throw new ConflictException(
        'Idempotency key already used with a different request body',
      );
    }

    if (!record) {
      try {
        record = await this.idempotencyRepo.insertPendingInTransaction(
          manager,
          {
            idempotencyKey: dto.idempotencyKey,
            scopeKey,
            requestFingerprint: fingerprint,
          },
        );
      } catch (err: unknown) {
        if (!isPostgresUniqueViolation(err)) {
          throw err;
        }
        record = await this.idempotencyRepo.findByIdempotencyKeyInTransaction(
          manager,
          dto.idempotencyKey,
          scopeKey,
        );
        if (!record) {
          throw err;
        }
      }
    }

    if (
      record.requestFingerprint != null &&
      record.requestFingerprint !== fingerprint
    ) {
      throw new ConflictException(
        'Idempotency key already used with a different request body',
      );
    }

    let payment = await manager.findOne(Payment, {
      where: { idempotencyRecordId: record.id },
    });

    if (!payment) {
      try {
        const created = manager.create(
          Payment,
          newPaymentFromDto(record.id, dto),
        );
        payment = await manager.save(created);
        record.linkedPaymentId = payment.id;
        record.businessReference = dto.reference;
        await manager.save(IdempotencyRecord, record);
      } catch (err: unknown) {
        if (!isPostgresUniqueViolation(err)) {
          throw err;
        }
        payment = await manager.findOne(Payment, {
          where: { idempotencyRecordId: record.id },
        });
        if (!payment) {
          throw err;
        }
      }
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return { idempotencyRecord: record, payment };
    }
    if (payment.status === PaymentStatus.FAILED) {
      return { idempotencyRecord: record, payment };
    }

    if (
      record.requestFingerprint === null ||
      record.requestFingerprint === undefined
    ) {
      record.requestFingerprint = fingerprint;
      await manager.save(IdempotencyRecord, record);
    }

    return { idempotencyRecord: record, payment };
  }

  private assertAccountsReady(
    source: { status: AccountStatus; currency: string },
    dest: { status: AccountStatus; currency: string },
    dto: CreatePaymentDto,
  ): void {
    if (
      source.status !== AccountStatus.ACTIVE ||
      dest.status !== AccountStatus.ACTIVE
    ) {
      throw new BadRequestException('Source and destination must be ACTIVE');
    }
    if (source.currency !== dto.currency || dest.currency !== dto.currency) {
      throw new BadRequestException('Currency mismatch for payment accounts');
    }
  }

  private buildLedgerPostDto(
    dto: CreatePaymentDto,
    paymentId: string,
  ): PostLedgerTransactionDto {
    const entries = [
      {
        accountId: dto.sourceAccountId,
        entryType: LedgerEntryType.DEBIT,
        amount: dto.amount,
        currency: dto.currency,
      },
      {
        accountId: dto.destinationAccountId,
        entryType: LedgerEntryType.CREDIT,
        amount: dto.amount,
        currency: dto.currency,
      },
    ];
    return {
      type: ledgerTypeForPayment(dto.type),
      correlationId: `payment:${paymentId}`,
      memo: dto.memo ?? `payment:${paymentId}`,
      entries,
    };
  }
}

function newPaymentFromDto(
  idempotencyRecordId: string,
  dto: CreatePaymentDto,
): Partial<Payment> {
  return {
    type: dto.type,
    status: PaymentStatus.PENDING,
    reference: dto.reference,
    idempotencyRecordId,
    sourceAccountId: dto.sourceAccountId,
    destinationAccountId: dto.destinationAccountId,
    amount: dto.amount,
    currency: dto.currency,
    ledgerTransactionId: null,
    correlationId: dto.correlationId ?? null,
    memo: dto.memo ?? null,
  };
}

function ledgerTypeForPayment(type: PaymentType): LedgerTransactionType {
  if (type === PaymentType.FEE) {
    return LedgerTransactionType.FEE;
  }
  return LedgerTransactionType.PAYMENT;
}

function fingerprintCreatePayment(dto: CreatePaymentDto): string {
  const { idempotencyKey, idempotencyScopeKey, ...body } = dto;
  return createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex')
    .slice(0, 64);
}

function isPostgresUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) {
    return false;
  }
  const driver = (err as QueryFailedError & { driverError?: { code?: string } })
    .driverError;
  return driver?.code === '23505';
}
