import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '../../infrastructure/cache/redis.module';
import { EvaluateFraudHandler } from './command/handlers/evaluate-fraud.handler';
import { FraudController } from './controller/fraud.controller';
import { FraudSignal } from './entities/fraud-signal.entity';
import { KnownDevice } from './entities/known-device.entity';
import { RiskDecision } from './entities/risk-decision.entity';
import { UserTransactionHourProfile } from './entities/user-transaction-hour-profile.entity';
import { GetRiskDecisionByReferenceHandler } from './query/handlers/get-risk-decision-by-reference.handler';
import { FraudRuleEngineService } from './service/fraud-rule-engine.service';
import { FraudRuleLogService } from './service/fraud-rule-log.service';
import { FraudService } from './service/fraud.service';

/**
 * Fraud bounded context — synchronous evaluation on the payment path and
 * internal HTTP for evaluation + risk-decision reads. Does not own ledger truth.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FraudSignal,
      RiskDecision,
      KnownDevice,
      UserTransactionHourProfile,
    ]),
    RedisModule,
  ],
  controllers: [FraudController],
  providers: [
    FraudRuleEngineService,
    FraudRuleLogService,
    FraudService,
    EvaluateFraudHandler,
    GetRiskDecisionByReferenceHandler,
  ],
  exports: [TypeOrmModule, FraudService],
})
export class FraudModule {}
