import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancelPayrollRunHandler } from './command/handlers/cancel-payroll-run.handler';
import { SubmitPayrollRunHandler } from './command/handlers/submit-payroll-run.handler';
import { PayrollController } from './controller/payroll.controller';
import { PayrollRun } from './entities/payroll-run.entity';
import { GetPayrollRunByIdHandler } from './query/handlers/get-payroll-run-by-id.handler';
import { PayrollRunRepository } from './repositories/payroll-run.repository';
import { PayrollService } from './service/payroll.service';

/**
 * Payroll bounded context — skeleton only; wires CQRS-style handlers and
 * persistence for upcoming reservation / fanout flows.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PayrollRun])],
  controllers: [PayrollController],
  providers: [
    PayrollRunRepository,
    PayrollService,
    SubmitPayrollRunHandler,
    CancelPayrollRunHandler,
    GetPayrollRunByIdHandler,
  ],
  exports: [PayrollService],
})
export class PayrollModule {}
