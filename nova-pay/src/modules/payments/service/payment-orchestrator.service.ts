import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { QueryFailedError } from 'typeorm';
import { AccountStatus } from '../../accounts/enums/account-status.enum';
import { AccountsService } from '../../accounts/service/accounts.service';
import { PostLedgerTransactionDto } from '../../ledger/dto/post-ledger-transaction.dto';
import { LedgerEntryType } from '../../ledger/enums/ledger-entry-type.enum';
import { LedgerTransactionType } from '../../ledger/enums/ledger-transaction-type.enum';
import { PostingService } from '../../ledger/service/posting.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { IdempotencyRecord } from '../entities/idempotency-record.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentType } from '../enums/payment-type.enum';
import { PaymentsService } from './payments.service';

/**
 * Coordinates payment intent → account checks → ledger post → payment outcome
 * using **exported** {@link AccountsService} and {@link PostingService} only.
 *
 * ## Money-path transaction design (NovaPay architecture)
 *
 * **Current code:** multiple round-trips/commits between idempotency, payment
 * `PROCESSING`, ledger, finalize/fail — **not** production-safe until collapsed.
 *
 * **Target ordering inside one PostgreSQL transaction** (single
 * `EntityManager` / query runner), after read-only short-circuit for payments
 * already `COMPLETED` or `FAILED`:
 *
 * 1. **Transaction start** — open the TX here (or one layer below with this
 *    orchestrator receiving `EntityManager`), before any durable write that must
 *    roll back with the ledger.
 * 2. **Idempotency row** — `SELECT … FROM payments_idempotency_records … FOR UPDATE`
 *    (and payment row materialization / fingerprint updates as needed) so
 *    concurrent retries serialize on the slot.
 * 3. **Account row locks** — `AccountsService.lockAccountForUpdate` on the debit
 *    source (required) and further accounts per policy **before** balance read
 *    and **before** ledger insert.
 * 4. **Balance / policy** — read `availableBalance` and overdraft rules with locks
 *    held; reject if insufficient (never validate in a different TX than post).
 * 5. **Ledger posting** — `PostingService.post` must run on the **same** manager
 *    (see ledger service TODOs): header + entries in one atomic write segment.
 * 6. **Balance projections** — update `accounts` projection columns from entry
 *    lines in that same TX (not implemented elsewhere yet).
 * 7. **Payment + idempotency outcome** — `COMPLETED` + `ledgerTransactionId` + slot
 *    `COMPLETED`, or failure path without a second ledger post.
 * 8. **Outbox** — `OutboxRepository.enqueueInTransaction` for `payment.*` and any
 *    `ledger.*` rows not already written inside `PostingService` in the same TX.
 * 9. **Commit** — RabbitMQ only after commit via outbox relay.
 *
 * TODO: **Fraud** — synchronous policy checks before step 5 with locks held.
 */
@Injectable()
export class PaymentOrchestratorService {
  constructor(
    private readonly payments: PaymentsService,
    private readonly accounts: AccountsService,
    private readonly posting: PostingService,
  ) {}

  /**
   * Executes an internal money movement backed by a ledger post.
   * Retries with the same idempotency key return the same {@link Payment}
   * row (completed or failed) without executing the ledger path again.
   */
  async submitPayment(dto: CreatePaymentDto): Promise<Payment> {
    const scopeKey = dto.idempotencyScopeKey ?? '';
    const fingerprint = fingerprintCreatePayment(dto);

    const { idempotencyRecord, payment } = await this.resolveIdempotencySlot(
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

    // TODO: Move pre-lock reads inside the money TX or repeat them after locks;
    // today these are unconstrained reads (see class-level phase 3–4).
    const source = await this.accounts.requireAccountById(dto.sourceAccountId);
    const dest = await this.accounts.requireAccountById(
      dto.destinationAccountId,
    );
    this.assertAccountsReady(source, dest, dto);

    // TODO: Phase 2–7 — set `PROCESSING` under idempotency `FOR UPDATE`, not as a
    // standalone commit before ledger (avoids orphan PROCESSING if process dies).
    payment.status = PaymentStatus.PROCESSING;
    await this.payments.savePayment(payment);

    const ledgerDto = this.buildLedgerPostDto(dto, payment.id);

    try {
      // TODO: Phases 3–6 — `lockAccountForUpdate` → balance check →
      // `posting.post(entityManager, …)` → projection updates (same TX).
      // TODO: Phase 8 — outbox rows for `ledger.transaction.posted` / `payment.completed`
      // before commit (see `PaymentsService.finalizeSuccessfulPayment`).
      const ledgerTx = await this.posting.post(ledgerDto);
      return this.payments.finalizeSuccessfulPayment(
        payment,
        idempotencyRecord,
        ledgerTx.id,
      );
    } catch (err: unknown) {
      // TODO: Phase 7–8 — failure updates + `payment.failed` outbox in the same TX
      // as any partial ledger work, or compensate per policy (no fake rollback here).
      await this.payments.markPaymentFailedWithIdempotency(
        payment,
        idempotencyRecord,
      );
      throw err;
    }
  }

  private async resolveIdempotencySlot(
    dto: CreatePaymentDto,
    scopeKey: string,
    fingerprint: string,
  ): Promise<{ idempotencyRecord: IdempotencyRecord; payment: Payment }> {
    let record = await this.payments.findIdempotencyByKey(
      dto.idempotencyKey,
      scopeKey,
    );

    if (record?.requestFingerprint && record.requestFingerprint !== fingerprint) {
      throw new ConflictException(
        'Idempotency key already used with a different request body',
      );
    }

    if (!record) {
      record = await this.tryCreateIdempotencySlot(
        dto.idempotencyKey,
        scopeKey,
        fingerprint,
      );
    }

    if (
      record.requestFingerprint != null &&
      record.requestFingerprint !== fingerprint
    ) {
      throw new ConflictException(
        'Idempotency key already used with a different request body',
      );
    }

    let payment = await this.payments.findPaymentByIdempotencyRecordId(
      record.id,
    );

    if (!payment) {
      payment = await this.payments.createPaymentFromDto(record.id, dto);
      await this.payments.linkIdempotencyToCreatedPayment(
        record,
        payment,
        dto.reference,
      );
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
      await this.payments.saveIdempotencyRecord(record);
    }

    return { idempotencyRecord: record, payment };
  }

  /**
   * Inserts a new idempotency row; on unique-key races, reloads the winner row.
   * TODO: Fold into phase 2 of the money TX (`INSERT` / `SELECT … FOR UPDATE`),
   * not as a separate commit before the transactional boundary starts.
   */
  private async tryCreateIdempotencySlot(
    idempotencyKey: string,
    scopeKey: string,
    fingerprint: string,
  ): Promise<IdempotencyRecord> {
    try {
      return await this.payments.createIdempotencyPending(
        idempotencyKey,
        scopeKey,
        fingerprint,
      );
    } catch (err: unknown) {
      if (!isPostgresUniqueViolation(err)) {
        throw err;
      }
      const existing = await this.payments.findIdempotencyByKey(
        idempotencyKey,
        scopeKey,
      );
      if (!existing) {
        throw err;
      }
      return existing;
    }
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
