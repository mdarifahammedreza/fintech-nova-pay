import { Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import {
  buildPaginationMeta,
  normalizePagination,
} from '../../../infrastructure/database/helpers/pagination.helper';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { QueryPaymentDto } from '../dto/query-payment.dto';
import {
  IdempotencyRecord,
  IdempotencyRecordStatus,
} from '../entities/idempotency-record.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { IdempotencyRecordRepository } from '../repositories/idempotency-record.repository';
import { PaymentRepository } from '../repositories/payment.repository';

export type PaginatedPayments = {
  items: Payment[];
  meta: ReturnType<typeof buildPaginationMeta>;
};

/**
 * Payment + idempotency persistence for this module. Uses payment repositories
 * only — no account or ledger repos.
 *
 * **Transaction boundary:** `finalizeSuccessfulPayment` and
 * `markPaymentFailedWithIdempotency` mutate payment + idempotency rows that
 * must eventually commit in the **same** PostgreSQL transaction as the ledger
 * insert, account projection updates, and outbox writes orchestrated by
 * `PaymentOrchestratorService` / `PostingService` (see their phase lists).
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly idempotency: IdempotencyRecordRepository,
  ) {}

  findIdempotencyByKey(
    idempotencyKey: string,
    scopeKey: string,
  ): Promise<IdempotencyRecord | null> {
    return this.idempotency.findByIdempotencyKey(idempotencyKey, scopeKey);
  }

  createIdempotencyPending(
    idempotencyKey: string,
    scopeKey: string,
    requestFingerprint: string | null,
  ): Promise<IdempotencyRecord> {
    return this.idempotency.save({
      idempotencyKey,
      scopeKey,
      status: IdempotencyRecordStatus.PENDING,
      requestFingerprint,
      linkedPaymentId: null,
      businessReference: null,
    });
  }

  /**
   * Binds the idempotency slot to the materialized payment + business reference
   * for support and outbox correlation (no payment/ledger rules).
   */
  async linkIdempotencyToCreatedPayment(
    record: IdempotencyRecord,
    payment: Payment,
    businessReference: string,
  ): Promise<void> {
    record.linkedPaymentId = payment.id;
    record.businessReference = businessReference;
    await this.idempotency.save(record);
  }

  saveIdempotencyRecord(row: IdempotencyRecord): Promise<IdempotencyRecord> {
    return this.idempotency.save(row);
  }

  findPaymentById(id: string): Promise<Payment | null> {
    return this.payments.findById(id);
  }

  findPaymentByReference(reference: string): Promise<Payment | null> {
    return this.payments.findByReference(reference);
  }

  findPaymentByIdempotencyRecordId(
    idempotencyRecordId: string,
  ): Promise<Payment | null> {
    return this.payments.findByIdempotencyRecordId(idempotencyRecordId);
  }

  createPaymentFromDto(
    idempotencyRecordId: string,
    dto: CreatePaymentDto,
    status: PaymentStatus = PaymentStatus.PENDING,
  ): Promise<Payment> {
    return this.payments.save({
      type: dto.type,
      status,
      reference: dto.reference,
      idempotencyRecordId,
      sourceAccountId: dto.sourceAccountId,
      destinationAccountId: dto.destinationAccountId,
      amount: dto.amount,
      currency: dto.currency,
      ledgerTransactionId: null,
      correlationId: dto.correlationId ?? null,
      memo: dto.memo ?? null,
    });
  }

  savePayment(row: Payment): Promise<Payment> {
    return this.payments.save(row);
  }

  /**
   * Marks payment completed and idempotency slot completed after a successful
   * ledger post.
   * TODO: Invoked inside the money TX only — same commit as ledger lines,
   * projections, and outbox: `payment.completed` (+ any `ledger.*` not written in
   * `PostingService`).
   */
  async finalizeSuccessfulPayment(
    payment: Payment,
    idempotencyRecord: IdempotencyRecord,
    ledgerTransactionId: string,
  ): Promise<Payment> {
    payment.status = PaymentStatus.COMPLETED;
    payment.ledgerTransactionId = ledgerTransactionId;
    idempotencyRecord.status = IdempotencyRecordStatus.COMPLETED;
    await this.idempotency.save(idempotencyRecord);
    return this.payments.save(payment);
  }

  async markPaymentFailed(payment: Payment): Promise<Payment> {
    payment.status = PaymentStatus.FAILED;
    return this.payments.save(payment);
  }

  /**
   * Terminal failure: marks both payment and idempotency slot so retries replay
   * the same outcome without re-posting to the ledger.
   * TODO: Same money TX as any compensating writes / outbox `payment.failed`;
   * if ledger posted in the same attempt, failure handling must follow policy
   * (reversal or mark-only) — not decided here.
   */
  async markPaymentFailedWithIdempotency(
    payment: Payment,
    idempotencyRecord: IdempotencyRecord,
  ): Promise<Payment> {
    payment.status = PaymentStatus.FAILED;
    idempotencyRecord.status = IdempotencyRecordStatus.FAILED;
    await this.idempotency.save(idempotencyRecord);
    return this.payments.save(payment);
  }

  async queryPayments(dto: QueryPaymentDto): Promise<PaginatedPayments> {
    const { page, limit, skip } = normalizePagination(dto.page, dto.limit);
    const where = this.buildPaymentWhere(dto);
    const [items, total] = await this.payments.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  private buildPaymentWhere(
    dto: QueryPaymentDto,
  ): FindOptionsWhere<Payment> {
    const w: FindOptionsWhere<Payment> = {};
    if (dto.type !== undefined) {
      w.type = dto.type;
    }
    if (dto.status !== undefined) {
      w.status = dto.status;
    }
    if (dto.reference !== undefined) {
      w.reference = dto.reference;
    }
    if (dto.sourceAccountId !== undefined) {
      w.sourceAccountId = dto.sourceAccountId;
    }
    if (dto.destinationAccountId !== undefined) {
      w.destinationAccountId = dto.destinationAccountId;
    }
    if (dto.currency !== undefined) {
      w.currency = dto.currency;
    }
    if (dto.correlationId !== undefined) {
      w.correlationId = dto.correlationId;
    }
    return w;
  }
}
