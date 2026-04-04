import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudSignal } from './entities/fraud-signal.entity';
import { KnownDevice } from './entities/known-device.entity';
import { RiskDecision } from './entities/risk-decision.entity';
import { UserTransactionHourProfile } from './entities/user-transaction-hour-profile.entity';

/**
 * Fraud bounded context — replaces batch/cron checks with synchronous
 * evaluation on the payment path (sub-200ms target). Does not own ledger
 * truth. Phases 2+ add Redis, repositories, rule engine, CQRS, and HTTP API.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FraudSignal,
      RiskDecision,
      KnownDevice,
      UserTransactionHourProfile,
    ]),
  ],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class FraudModule {}
