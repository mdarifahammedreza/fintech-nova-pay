import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CreatePayrollBatchHandler } from './command/handlers/create-payroll-batch.handler';
import { ProcessPayrollBatchHandler } from './command/handlers/process-payroll-batch.handler';
import { PayrollController } from './controller/payroll.controller';
import { PayrollBatch } from './entities/payroll-batch.entity';
import { PayrollFundingReservation } from './entities/payroll-funding-reservation.entity';
import { PayrollItem } from './entities/payroll-item.entity';
import { GetPayrollBatchByIdHandler } from './query/handlers/get-payroll-batch-by-id.handler';
import { PayrollBatchRepository } from './repositories/payroll-batch.repository';
import { PayrollFundingReservationRepository } from './repositories/payroll-funding-reservation.repository';
import { PayrollItemRepository } from './repositories/payroll-item.repository';
import { PayrollOrchestratorService } from './service/payroll-orchestrator.service';
import { PayrollService } from './service/payroll.service';
import { PayrollValidationService } from './service/payroll-validation.service';

/**
 * Payroll bounded context — batch create/process and reads via handlers +
 * {@link PayrollService} / {@link PayrollOrchestratorService}.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PayrollBatch,
      PayrollItem,
      PayrollFundingReservation,
    ]),
    OutboxModule,
    AccountsModule,
    AuthModule,
    LedgerModule,
  ],
  controllers: [PayrollController],
  providers: [
    PayrollBatchRepository,
    PayrollItemRepository,
    PayrollFundingReservationRepository,
    PayrollService,
    PayrollValidationService,
    PayrollOrchestratorService,
    CreatePayrollBatchHandler,
    ProcessPayrollBatchHandler,
    GetPayrollBatchByIdHandler,
    JwtAuthGuard,
  ],
  exports: [PayrollService, PayrollOrchestratorService],
})
export class PayrollModule {}
