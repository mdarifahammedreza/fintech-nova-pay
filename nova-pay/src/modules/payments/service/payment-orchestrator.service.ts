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
 * Coordinates payment intent → locked account checks → ledger post → payment
 * outcome in one `DataSource.transaction`, using {@link PostingService},
 * {@link OutboxRepository}, and {@link IdempotencyRecordRepository}.
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
 * **Accounts:** source and destination are loaded with `FOR UPDATE` (sorted by
 * id, same order as ledger balance validation) before status/currency checks.
 *
 * TODO: **Fraud** — synchronous policy checks before ledger with locks held.
 *
 * Outbox: persists `payment.created` (first materialize), `payment.completed` /
 * `payment.failed` (terminal), and ledger rows from {@link PostingService}, all
 * in **this** DB transaction. That only guarantees rows exist for the relay;
 * RabbitMQ publish and consumer handling are separate (at-least-once; dedupe in
 * consumers per architecture).
 *
 * **Failure path:** after a ledger error, FAILED rows and `payment.failed`
 * outbox are persisted and the callback **returns** the payment (no `throw`) so
 * the transaction commits; callers map `FAILED` to HTTP.
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
   * Same idempotency key returns the stored {@link Payment}; once status is
   * `COMPLETED` or `FAILED`, the ledger path is not run again for that key.
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

      const { source, dest } = await this.loadPaymentAccountsLocked(
        manager,
        dto,
      );
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
        await this.outbox.enqueueInTransaction(manager, {
          routingKey: OutboxRoutingKey.PAYMENT_CREATED,
          correlationId: payment.correlationId ?? dto.correlationId ?? null,
          occurredAt: new Date(),
          payload: {
            paymentId: payment.id,
            idempotencyRecordId: record.id,
            reference: payment.reference,
            amount: payment.amount,
            currency: payment.currency,
            type: payment.type,
            sourceAccountId: payment.sourceAccountId,
            destinationAccountId: payment.destinationAccountId,
          },
        });
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

  /**
   * `FOR UPDATE` on payment legs in **sorted account id** order (matches
   * {@link PostingService} balance validation) to avoid deadlocks. Status and
   * currency checks run only after these locks are held.
   */
  private async loadPaymentAccountsLocked(
    manager: EntityManager,
    dto: CreatePaymentDto,
  ): Promise<{ source: Account; dest: Account }> {
    const uniqueSorted = [
      ...new Set([dto.sourceAccountId, dto.destinationAccountId]),
    ].sort();
    const byId = new Map<string, Account>();
    for (const id of uniqueSorted) {
      const row = await manager.findOne(Account, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        const label =
          id === dto.sourceAccountId
            ? 'Source account not found'
            : id === dto.destinationAccountId
              ? 'Destination account not found'
              : 'Account not found';
        throw new NotFoundException(label);
      }
      byId.set(row.id, row);
    }
    const source = byId.get(dto.sourceAccountId);
    const dest = byId.get(dto.destinationAccountId);
    if (!source || !dest) {
      throw new NotFoundException('Source or destination account not found');
    }
    return { source, dest };
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

/**
 * JSON-stable structure: plain objects get keys sorted recursively; arrays keep
 * element order; `undefined` object properties are omitted (JSON.stringify
 * semantics). Ensures identical logical bodies hash the same in any engine.
 */
function canonicalizeForFingerprint(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeForFingerprint(item));
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const v = obj[k];
      if (v === undefined) {
        continue;
      }
      out[k] = canonicalizeForFingerprint(v);
    }
    return out;
  }
  return String(value);
}

function fingerprintCreatePayment(dto: CreatePaymentDto): string {
  const { idempotencyKey, idempotencyScopeKey, ...body } = dto;
  const canonical = JSON.stringify(canonicalizeForFingerprint(body));
  return createHash('sha256')
    .update(canonical)
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
