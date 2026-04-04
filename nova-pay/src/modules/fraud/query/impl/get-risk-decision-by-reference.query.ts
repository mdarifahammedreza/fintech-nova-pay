import { QueryRiskDecisionDto } from '../../dto/query-risk-decision.dto';

/**
 * Read model: load persisted risk decision by payment reference.
 */
export class GetRiskDecisionByReferenceQuery {
  constructor(public readonly dto: QueryRiskDecisionDto) {}
}
