import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { FraudModule } from '../fraud/fraud.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CreatePaymentHandler } from './command/handlers/create-payment.handler';
import { PaymentsController } from './controller/payments.controller';
import { IdempotencyRecord } from './entities/idempotency-record.entity';
import { Payment } from './entities/payment.entity';
import { GetPaymentByIdHandler } from './query/handlers/get-payment-by-id.handler';
import { GetPaymentByReferenceHandler } from './query/handlers/get-payment-by-reference.handler';
import { IdempotencyRecordRepository } from './repositories/idempotency-record.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { PaymentOrchestratorService } from './service/payment-orchestrator.service';
import { PaymentsService } from './service/payments.service';

/**
 * Payments bounded context — HTTP via handlers; ledger/accounts only through
 * their exported services.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, IdempotencyRecord]),
    AccountsModule,
    AuthModule,
    FraudModule,
    LedgerModule,
    OutboxModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentRepository,
    IdempotencyRecordRepository,
    PaymentsService,
    PaymentOrchestratorService,
    CreatePaymentHandler,
    GetPaymentByIdHandler,
    GetPaymentByReferenceHandler,
    JwtAuthGuard,
  ],
  exports: [PaymentsService, PaymentOrchestratorService],
})
export class PaymentsModule {}
