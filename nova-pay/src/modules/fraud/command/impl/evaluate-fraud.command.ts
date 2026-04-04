import { EvaluateFraudDto } from '../../dto/evaluate-fraud.dto';

/**
 * Command: run synchronous fraud evaluation for one payment attempt.
 */
export class EvaluateFraudCommand {
  constructor(public readonly dto: EvaluateFraudDto) {}
}
