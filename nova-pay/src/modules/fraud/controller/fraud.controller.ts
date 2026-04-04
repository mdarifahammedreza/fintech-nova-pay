import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Currency } from '../../accounts/enums/currency.enum';
import { EvaluateFraudHandler } from '../command/handlers/evaluate-fraud.handler';
import { EvaluateFraudCommand } from '../command/impl/evaluate-fraud.command';
import { EvaluateFraudDto } from '../dto/evaluate-fraud.dto';
import { QueryRiskDecisionDto } from '../dto/query-risk-decision.dto';
import { RiskDecision } from '../entities/risk-decision.entity';
import { FraudDecisionState } from '../enums/fraud-decision-state.enum';
import { GetRiskDecisionByReferenceHandler } from '../query/handlers/get-risk-decision-by-reference.handler';
import { GetRiskDecisionByReferenceQuery } from '../query/impl/get-risk-decision-by-reference.query';

export class RiskDecisionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: FraudDecisionState })
  finalDecision: FraudDecisionState;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  sourceAccountId: string;

  @ApiProperty({ format: 'uuid' })
  destinationAccountId: string;

  @ApiProperty({ format: 'uuid' })
  recipientAccountId: string;

  @ApiProperty({ format: 'uuid' })
  senderAccountId: string;

  @ApiProperty({ example: '100.0000' })
  amount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ maxLength: 128 })
  paymentReference: string;

  @ApiProperty({ maxLength: 128 })
  correlationId: string;

  @ApiProperty({ type: [String] })
  finalReasons: string[];

  @ApiProperty({ type: [String] })
  triggeredRuleTypes: string[];

  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
  })
  engineMetadata: Record<string, unknown> | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

function toRiskDecisionResponse(row: RiskDecision): RiskDecisionResponseDto {
  return {
    id: row.id,
    finalDecision: row.finalDecision,
    userId: row.userId,
    sourceAccountId: row.sourceAccountId,
    destinationAccountId: row.destinationAccountId,
    recipientAccountId: row.recipientAccountId,
    senderAccountId: row.senderAccountId,
    amount: row.amount,
    currency: row.currency,
    paymentReference: row.paymentReference,
    correlationId: row.correlationId,
    finalReasons: row.finalReasons,
    triggeredRuleTypes: row.triggeredRuleTypes,
    engineMetadata: row.engineMetadata,
    createdAt: row.createdAt,
  };
}

/**
 * Fraud HTTP surface — internal synchronous evaluation and read-side lookup.
 * TODO: JwtAuthGuard + service-to-service or operator policy.
 */
@Controller('fraud')
@ApiTags('fraud')
@ApiBearerAuth()
export class FraudController {
  constructor(
    private readonly evaluateFraudHandler: EvaluateFraudHandler,
    private readonly getRiskDecisionByReferenceHandler: GetRiskDecisionByReferenceHandler,
  ) {}

  @Post('evaluate')
  @ApiOperation({
    summary: 'Evaluate fraud synchronously (internal)',
    description:
      'Runs all rules before payment approval. Does not move money or touch ' +
      'ledger tables.',
  })
  @ApiBody({ type: EvaluateFraudDto })
  @ApiOkResponse({ type: RiskDecisionResponseDto })
  async evaluate(
    @Body() dto: EvaluateFraudDto,
  ): Promise<RiskDecisionResponseDto> {
    const row = await this.evaluateFraudHandler.execute(
      new EvaluateFraudCommand(dto),
    );
    return toRiskDecisionResponse(row);
  }

  @Get('risk-decisions')
  @ApiOperation({
    summary: 'Get risk decision by payment reference',
    description:
      'Returns the latest persisted decision for the reference; optional ' +
      'correlationId narrows duplicates.',
  })
  @ApiOkResponse({ type: RiskDecisionResponseDto })
  async getRiskDecision(
    @Query() query: QueryRiskDecisionDto,
  ): Promise<RiskDecisionResponseDto> {
    const row = await this.getRiskDecisionByReferenceHandler.execute(
      new GetRiskDecisionByReferenceQuery(query),
    );
    if (!row) {
      throw new NotFoundException('Risk decision not found');
    }
    return toRiskDecisionResponse(row);
  }
}
