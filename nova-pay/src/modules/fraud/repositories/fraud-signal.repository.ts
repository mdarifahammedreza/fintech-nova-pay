import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { FraudSignal } from '../entities/fraud-signal.entity';

/**
 * `fraud_signals` persistence. Hot-path inserts run inside
 * {@link RiskDecisionRepository.saveDecisionAndSignalsInTransaction} under
 * {@link FraudRuleLogService.persistRiskDecisionAndSignals}.
 */
@Injectable()
export class FraudSignalRepository extends BaseRepository<FraudSignal> {
  constructor(
    @InjectRepository(FraudSignal)
    repository: Repository<FraudSignal>,
  ) {
    super(repository);
  }
}
