import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentsModule } from '../payments/payments.module';
import { ApplyLoanHandler } from './command/handlers/apply-loan.handler';
import { DisburseLoanHandler } from './command/handlers/disburse-loan.handler';
import { RepayLoanHandler } from './command/handlers/repay-loan.handler';
import { LoansController } from './controller/loans.controller';
import { LoanRepayment } from './entities/loan-repayment.entity';
import { Loan } from './entities/loan.entity';
import { GetLoanByIdHandler } from './query/handlers/get-loan-by-id.handler';
import { LoanRepaymentRepository } from './repositories/loan-repayment.repository';
import { LoanRepository } from './repositories/loan.repository';
import { LoanOrchestrationService } from './service/loan-orchestration.service';
import { LoanOverdueService } from './service/loan-overdue.service';
import { LoanPersistenceService } from './service/loan-persistence.service';
import { LoansService } from './service/loans.service';

/**
 * Loans bounded context — persistence vs orchestration split; money paths use
 * exported payment + ledger services only.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Loan, LoanRepayment]),
    OutboxModule,
    AuthModule,
    LedgerModule,
    PaymentsModule,
  ],
  controllers: [LoansController],
  providers: [
    LoanRepository,
    LoanRepaymentRepository,
    LoanPersistenceService,
    LoanOrchestrationService,
    LoanOverdueService,
    LoansService,
    ApplyLoanHandler,
    DisburseLoanHandler,
    RepayLoanHandler,
    GetLoanByIdHandler,
    JwtAuthGuard,
  ],
  exports: [LoansService, LoanOrchestrationService, LoanPersistenceService],
})
export class LoansModule {}
