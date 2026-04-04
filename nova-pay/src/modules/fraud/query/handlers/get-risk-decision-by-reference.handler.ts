import { Injectable } from '@nestjs/common';
import { RiskDecision } from '../../entities/risk-decision.entity';
import { FraudService } from '../../service/fraud.service';
import { GetRiskDecisionByReferenceQuery } from '../impl/get-risk-decision-by-reference.query';

@Injectable()
export class GetRiskDecisionByReferenceHandler {
  constructor(private readonly fraud: FraudService) {}

  execute(
    query: GetRiskDecisionByReferenceQuery,
  ): Promise<RiskDecision | null> {
    return this.fraud.getRiskDecisionByReference(
      query.dto.paymentReference,
      query.dto.correlationId,
    );
  }
}
