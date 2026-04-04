import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Currency } from '../../accounts/enums/currency.enum';
import { PostLedgerTransactionHandler } from '../command/handlers/post-ledger-transaction.handler';
import { ReverseLedgerTransactionHandler } from '../command/handlers/reverse-ledger-transaction.handler';
import { PostLedgerTransactionCommand } from '../command/impl/post-ledger-transaction.command';
import { ReverseLedgerTransactionCommand } from '../command/impl/reverse-ledger-transaction.command';
import { PostLedgerTransactionDto } from '../dto/post-ledger-transaction.dto';
import { ReverseLedgerTransactionDto } from '../dto/reverse-ledger-transaction.dto';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { LedgerTransaction } from '../entities/ledger-transaction.entity';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';
import { LedgerTransactionStatus } from '../enums/ledger-transaction-status.enum';
import { LedgerTransactionType } from '../enums/ledger-transaction-type.enum';
import { GetLedgerTransactionByIdHandler } from '../query/handlers/get-ledger-transaction-by-id.handler';
import { GetLedgerTransactionByIdQuery } from '../query/impl/get-ledger-transaction-by-id.query';
import { assertIdempotencyKeyMatchesBodyField } from '../../../common/utils/assert-idempotency-key-matches-body-field.util';

export class LedgerEntryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ledgerTransactionId: string;

  @ApiProperty({ format: 'uuid' })
  accountId: string;

  @ApiProperty({ enum: LedgerEntryType })
  entryType: LedgerEntryType;

  @ApiProperty()
  amount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty()
  lineNumber: number;

  @ApiProperty({ nullable: true })
  memo: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class LedgerTransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: LedgerTransactionType })
  type: LedgerTransactionType;

  @ApiProperty({ enum: LedgerTransactionStatus })
  status: LedgerTransactionStatus;

  @ApiProperty({ format: 'uuid', nullable: true })
  reversesTransactionId: string | null;

  @ApiProperty({ nullable: true })
  correlationId: string | null;

  @ApiProperty({ nullable: true })
  memo: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: LedgerEntryResponseDto, isArray: true })
  entries: LedgerEntryResponseDto[];
}

function toEntryResponse(e: LedgerEntry): LedgerEntryResponseDto {
  return {
    id: e.id,
    ledgerTransactionId: e.ledgerTransactionId,
    accountId: e.accountId,
    entryType: e.entryType,
    amount: e.amount,
    currency: e.currency,
    lineNumber: e.lineNumber,
    memo: e.memo,
    createdAt: e.createdAt,
  };
}

function toTransactionResponse(
  tx: LedgerTransaction,
): LedgerTransactionResponseDto {
  return {
    id: tx.id,
    type: tx.type,
    status: tx.status,
    reversesTransactionId: tx.reversesTransactionId,
    correlationId: tx.correlationId,
    memo: tx.memo,
    createdAt: tx.createdAt,
    entries: (tx.entries ?? []).map(toEntryResponse),
  };
}

/**
 * Ledger HTTP surface — postings and reads only. Writes call
 * {@link PostingService.post} / reversal; mutating routes require
 * `Idempotency-Key` = `correlationId` (NovaPay money-API rules).
 * TODO: `JwtAuthGuard` + admin / internal API policy.
 */
@Controller('ledger')
@ApiTags('ledger')
@ApiBearerAuth()
export class LedgerController {
  constructor(
    private readonly postHandler: PostLedgerTransactionHandler,
    private readonly reverseHandler: ReverseLedgerTransactionHandler,
    private readonly getByIdHandler: GetLedgerTransactionByIdHandler,
  ) {}

  @Post('transactions')
  @ApiOperation({ summary: 'Post a ledger transaction (balanced entries)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Must match `correlationId` in the body (stable across retries)',
  })
  @ApiBody({ type: PostLedgerTransactionDto })
  @ApiOkResponse({ type: LedgerTransactionResponseDto })
  async postTransaction(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() dto: PostLedgerTransactionDto,
  ): Promise<LedgerTransactionResponseDto> {
    assertIdempotencyKeyMatchesBodyField(
      idempotencyKeyHeader,
      dto.correlationId,
      'correlationId',
    );
    const tx = await this.postHandler.execute(
      new PostLedgerTransactionCommand(dto),
    );
    return toTransactionResponse(tx);
  }

  @Post('reversals')
  @ApiOperation({ summary: 'Reverse a posted ledger transaction' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Must match `correlationId` in the body (stable across retries)',
  })
  @ApiBody({ type: ReverseLedgerTransactionDto })
  @ApiOkResponse({ type: LedgerTransactionResponseDto })
  async reverseTransaction(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() dto: ReverseLedgerTransactionDto,
  ): Promise<LedgerTransactionResponseDto> {
    assertIdempotencyKeyMatchesBodyField(
      idempotencyKeyHeader,
      dto.correlationId,
      'correlationId',
    );
    const tx = await this.reverseHandler.execute(
      new ReverseLedgerTransactionCommand(dto),
    );
    return toTransactionResponse(tx);
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get ledger transaction with entries' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: LedgerTransactionResponseDto })
  async getTransaction(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LedgerTransactionResponseDto> {
    const tx = await this.getByIdHandler.execute(
      new GetLedgerTransactionByIdQuery(id),
    );
    if (!tx) {
      throw new NotFoundException('Ledger transaction not found');
    }
    return toTransactionResponse(tx);
  }
}
