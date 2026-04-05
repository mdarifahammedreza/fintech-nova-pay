import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { paymentLedgerCorrelationId } from '../../payments/constants/payment-ledger-link.constants';
import { CreatePaymentDto } from '../../payments/dto/create-payment.dto';
import { PaymentStatus } from '../../payments/enums/payment-status.enum';
import { PaymentType } from '../../payments/enums/payment-type.enum';
import { PaymentOrchestratorService } from '../../payments/service/payment-orchestrator.service';
import { ApplyLoanDto } from '../dto/apply-loan.dto';
import { DisburseLoanDto } from '../dto/disburse-loan.dto';
import { RepayLoanDto } from '../dto/repay-loan.dto';
import { LoanRepayment } from '../entities/loan-repayment.entity';
import { Loan } from '../entities/loan.entity';
import { LoanAppliedEvent } from '../events/loan-applied.event';
import { LoanDisbursedEvent } from '../events/loan-disbursed.event';
import { LoanRepaymentReceivedEvent } from '../events/loan-repayment-received.event';
import { LoanRepaymentStatus } from '../enums/loan-repayment-status.enum';
import { LoanStatus } from '../enums/loan-status.enum';
import {
  amountGte4,
  parseAmountToBigInt4,
  subtractAmount4,
} from '../utils/loan-money.util';
import { LoanPersistenceService } from './loan-persistence.service';

/**
 * Money-moving coordination: payments + ledger via
 * {@link PaymentOrchestratorService} only; loan rows + loan outbox in the same
 * PostgreSQL transaction.
 */
@Injectable()
export class LoanOrchestrationService {
  constructor(
    private readonly persistence: LoanPersistenceService,
    private readonly payments: PaymentOrchestratorService,
    private readonly outbox: OutboxRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async applyForLoan(dto: ApplyLoanDto, actorUserId: string): Promise<Loan> {
    if (dto.borrowerUserId !== actorUserId) {
      throw new ForbiddenException(
        'Cannot submit a loan application for another user',
      );
    }

    const scope = dto.applyIdempotencyScopeKey ?? '';

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const existing = await manager.findOne(Loan, {
        where: {
          applyIdempotencyKey: dto.applyIdempotencyKey,
          applyIdempotencyScopeKey: scope,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing) {
        return existing;
      }

      const maturityDate = dto.maturityDate
        ? new Date(dto.maturityDate)
        : null;

      const loan = manager.create(Loan, {
        borrowerUserId: dto.borrowerUserId,
        status: LoanStatus.APPROVED,
        principalAmount: dto.principalAmount,
        outstandingPrincipal: '0.0000',
        currency: dto.currency,
        borrowerWalletAccountId: dto.borrowerWalletAccountId ?? null,
        loanFundingAccountId: dto.loanFundingAccountId ?? null,
        interestRateBps: dto.interestRateBps ?? null,
        termMonths: dto.termMonths ?? null,
        maturityDate,
        applyIdempotencyKey: dto.applyIdempotencyKey,
        applyIdempotencyScopeKey: scope,
        approvedAt: new Date(),
      });

      let saved: Loan;
      try {
        saved = await manager.save(Loan, loan);
      } catch (err: unknown) {
        if (!isPgUniqueViolation(err)) {
          throw err;
        }
        const replay = await manager.findOne(Loan, {
          where: {
            applyIdempotencyKey: dto.applyIdempotencyKey,
            applyIdempotencyScopeKey: scope,
          },
        });
        if (!replay) {
          throw err;
        }
        return replay;
      }

      const occurredAt = new Date();
      await this.outbox.enqueueInTransaction(manager, {
        routingKey: OutboxRoutingKey.LOAN_APPLIED,
        correlationId: saved.id,
        occurredAt,
        payload: new LoanAppliedEvent(
          saved.id,
          occurredAt.toISOString(),
        ).toJSON(),
      });
      return saved;
    });
  }

  async disburseApprovedToWallet(
    loanId: string,
    dto: DisburseLoanDto,
    actorUserId: string,
  ): Promise<Loan> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const loan = await this.persistence.lockLoanById(manager, loanId);
      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      if (
        loan.status === LoanStatus.ACTIVE &&
        loan.disbursementPaymentId != null
      ) {
        return loan;
      }

      if (
        loan.status !== LoanStatus.APPROVED &&
        loan.status !== LoanStatus.PENDING_REVIEW
      ) {
        throw new BadRequestException(
          'Loan must be APPROVED or PENDING_REVIEW to disburse',
        );
      }

      if (
        !loan.borrowerWalletAccountId ||
        !loan.loanFundingAccountId
      ) {
        throw new BadRequestException(
          'Loan must have borrowerWalletAccountId and loanFundingAccountId',
        );
      }

      const payDto: CreatePaymentDto = {
        idempotencyKey: dto.idempotencyKey,
        idempotencyScopeKey: dto.idempotencyScopeKey ?? '',
        type: PaymentType.INTERNAL_TRANSFER,
        reference: dto.reference,
        sourceAccountId: loan.loanFundingAccountId,
        destinationAccountId: loan.borrowerWalletAccountId,
        amount: loan.principalAmount,
        currency: loan.currency,
        correlationId: `loan-disburse:${loan.id}`.slice(0, 128),
        memo: dto.memo ?? undefined,
      };

      const payment = await this.payments.submitPaymentWithSharedManager(
        manager,
        payDto,
        actorUserId,
      );

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException(
          `Disbursement payment did not complete (status=${payment.status})`,
        );
      }

      loan.status = LoanStatus.ACTIVE;
      loan.outstandingPrincipal = loan.principalAmount;
      loan.disbursementPaymentId = payment.id;
      loan.disbursementCorrelationId = paymentLedgerCorrelationId(payment.id);
      loan.disbursedAt = new Date();
      if (!loan.approvedAt) {
        loan.approvedAt = new Date();
      }

      const saved = await this.persistence.persistLoanInTransaction(
        manager,
        loan,
      );

      const occurredAt = new Date();
      await this.outbox.enqueueInTransaction(manager, {
        routingKey: OutboxRoutingKey.LOAN_DISBURSED,
        correlationId: saved.id,
        occurredAt,
        payload: new LoanDisbursedEvent(
          saved.id,
          payment.id,
          payment.amount,
          payment.currency,
          occurredAt.toISOString(),
        ).toJSON(),
      });

      return saved;
    });
  }

  async repayFromWallet(
    loanId: string,
    dto: RepayLoanDto,
    actorUserId: string,
  ): Promise<Loan> {
    let repayBig: bigint;
    try {
      repayBig = parseAmountToBigInt4(dto.amount);
    } catch {
      throw new BadRequestException('Invalid repayment amount');
    }
    if (repayBig <= 0n) {
      throw new BadRequestException('Repayment amount must be positive');
    }

    return this.dataSource.transaction(async (manager: EntityManager) => {
      const loan = await this.persistence.lockLoanById(manager, loanId);
      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      if (loan.borrowerUserId !== actorUserId) {
        throw new ForbiddenException('Only the borrower can repay this loan');
      }

      if (
        loan.status !== LoanStatus.ACTIVE &&
        loan.status !== LoanStatus.OVERDUE
      ) {
        throw new BadRequestException(
          'Loan must be ACTIVE or OVERDUE to accept repayment',
        );
      }

      if (!loan.loanFundingAccountId) {
        throw new BadRequestException('Loan has no loanFundingAccountId');
      }

      if (!amountGte4(loan.outstandingPrincipal, dto.amount)) {
        throw new BadRequestException(
          'Repayment exceeds outstanding principal',
        );
      }

      const payDto: CreatePaymentDto = {
        idempotencyKey: dto.idempotencyKey,
        idempotencyScopeKey: dto.idempotencyScopeKey ?? '',
        type: PaymentType.INTERNAL_TRANSFER,
        reference: dto.reference,
        sourceAccountId: dto.sourceAccountId,
        destinationAccountId: loan.loanFundingAccountId,
        amount: dto.amount,
        currency: loan.currency,
        correlationId: `loan-repay:${loan.id}`.slice(0, 128),
        memo: dto.memo ?? undefined,
      };

      const payment = await this.payments.submitPaymentWithSharedManager(
        manager,
        payDto,
        actorUserId,
      );

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException(
          `Repayment payment did not complete (status=${payment.status})`,
        );
      }

      const dupeRepay = await manager.findOne(LoanRepayment, {
        where: { loanId: loan.id, paymentId: payment.id },
      });
      if (dupeRepay) {
        const reloaded = await manager.findOne(Loan, {
          where: { id: loan.id },
        });
        return reloaded ?? loan;
      }

      const newOutstanding = subtractAmount4(
        loan.outstandingPrincipal,
        dto.amount,
      );
      loan.outstandingPrincipal = newOutstanding;
      loan.lastRepaymentPaymentId = payment.id;
      if (parseAmountToBigInt4(newOutstanding) === 0n) {
        loan.status = LoanStatus.CLOSED;
        loan.closedAt = new Date();
      }

      const saved = await this.persistence.persistLoanInTransaction(
        manager,
        loan,
      );

      const repayment = manager.create(LoanRepayment, {
        loanId: saved.id,
        amount: dto.amount,
        status: LoanRepaymentStatus.COMPLETED,
        paymentId: payment.id,
        paymentCorrelationId: paymentLedgerCorrelationId(payment.id),
      });
      await this.persistence.persistRepaymentInTransaction(
        manager,
        repayment,
      );

      const occurredAt = new Date();
      await this.outbox.enqueueInTransaction(manager, {
        routingKey: OutboxRoutingKey.LOAN_REPAYMENT_RECEIVED,
        correlationId: saved.id,
        occurredAt,
        payload: new LoanRepaymentReceivedEvent(
          saved.id,
          payment.id,
          dto.amount,
          loan.currency,
          newOutstanding,
          occurredAt.toISOString(),
        ).toJSON(),
      });

      return saved;
    });
  }
}

function isPgUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) {
    return false;
  }
  const driver = (err as QueryFailedError & { driverError?: { code?: string } })
    .driverError;
  return driver?.code === '23505';
}
