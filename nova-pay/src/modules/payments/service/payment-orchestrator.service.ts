import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
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
 * TODO: **Idempotency** — enforce under DB serializable isolation or advisory
 * locks; handle races on `payments_idempotency_records` unique constraint;
 * complete CONFLICT vs replay semantics.
 * TODO: **Source row lock** — call {@link AccountsService.lockAccountForUpdate}
 * inside the same transaction as balance check + ledger + projections.
 * TODO: **Balance validation** — read `availableBalance` / overdraft after
 * lock; **never** validate in one transaction and post in another.
 * TODO: **Outbox** — insert `payment.*` (and ledger) outbox rows in the same
 * commit as payment/ledger writes; **never** publish RabbitMQ before commit.
 * TODO: **Fraud** — synchronous checks before releasing funds (architecture).
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
   * Today: sequential calls — must be collapsed into one TX (see TODOs above).
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
      throw new ConflictException(
        'Payment failed previously for this idempotency key; use a new key to retry',
      );
    }

    const source = await this.accounts.requireAccountById(dto.sourceAccountId);
    const dest = await this.accounts.requireAccountById(
      dto.destinationAccountId,
    );
    this.assertAccountsReady(source, dest, dto);

    payment.status = PaymentStatus.PROCESSING;
    await this.payments.savePayment(payment);

    const ledgerDto = this.buildLedgerPostDto(dto, payment.id);

    try {
      // TODO: `accounts.lockAccountForUpdate` + balance check immediately before
      // this call, in the **same** DB transaction as `posting.post` and any
      // projection updates (architecture: never split check vs debit).
      const ledgerTx = await this.posting.post(ledgerDto);
      return this.payments.finalizeSuccessfulPayment(
        payment,
        idempotencyRecord,
        ledgerTx.id,
      );
    } catch (err) {
      await this.payments.markPaymentFailed(payment);
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
      record = await this.payments.createIdempotencyPending(
        dto.idempotencyKey,
        scopeKey,
        fingerprint,
      );
    }

    let payment = await this.payments.findPaymentByIdempotencyRecordId(
      record.id,
    );

    if (!payment) {
      payment = await this.payments.createPaymentFromDto(record.id, dto);
    }

    if (payment.status === PaymentStatus.COMPLETED) {
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
