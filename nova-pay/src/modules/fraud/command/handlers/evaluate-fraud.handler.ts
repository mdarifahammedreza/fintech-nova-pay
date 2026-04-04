import { Injectable } from '@nestjs/common';
import { RiskDecision } from '../../entities/risk-decision.entity';
import { EvaluateFraudDto } from '../../dto/evaluate-fraud.dto';
import { FraudEvaluationContext } from '../../interfaces/fraud-evaluation-context.interface';
import { FraudService } from '../../service/fraud.service';
import { EvaluateFraudCommand } from '../impl/evaluate-fraud.command';

function toContext(dto: EvaluateFraudDto): FraudEvaluationContext {
  return {
    userId: dto.userId,
    sourceAccountId: dto.sourceAccountId,
    destinationAccountId: dto.destinationAccountId,
    recipientAccountId: dto.recipientAccountId,
    senderAccountId: dto.senderAccountId,
    amount: dto.amount,
    currency: dto.currency,
    paymentReference: dto.paymentReference,
    correlationId: dto.correlationId,
    deviceId: dto.deviceId?.trim() ?? null,
    deviceFingerprint: dto.deviceFingerprint?.trim() ?? null,
    transactionTimestamp: dto.transactionTimestamp,
  };
}

@Injectable()
export class EvaluateFraudHandler {
  constructor(private readonly fraud: FraudService) {}

  execute(command: EvaluateFraudCommand): Promise<RiskDecision> {
    return this.fraud.evaluateSynchronously(toContext(command.dto));
  }
}
