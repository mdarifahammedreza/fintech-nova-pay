import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { assertIdempotencyKeyMatchesBodyField } from '../../../common/utils/assert-idempotency-key-matches-body-field.util';
import { JwtAuthGuard } from '../../../infrastructure/auth/jwt-auth.guard';
import { PostLedgerTransactionHandler } from '../command/handlers/post-ledger-transaction.handler';
import { ReverseLedgerTransactionHandler } from '../command/handlers/reverse-ledger-transaction.handler';
import { PostLedgerTransactionCommand } from '../command/impl/post-ledger-transaction.command';
import { ReverseLedgerTransactionCommand } from '../command/impl/reverse-ledger-transaction.command';
import { PostLedgerTransactionDto } from '../dto/post-ledger-transaction.dto';
import { ReverseLedgerTransactionDto } from '../dto/reverse-ledger-transaction.dto';
import {
  LedgerTransactionResponseDto,
  toLedgerTransactionResponse,
} from '../dto/ledger-transaction-response.dto';
import { GetLedgerTransactionByIdHandler } from '../query/handlers/get-ledger-transaction-by-id.handler';
import { GetLedgerTransactionByIdQuery } from '../query/impl/get-ledger-transaction-by-id.query';

/**
 * Ledger HTTP surface — postings and reads only. Writes call
 * {@link PostingService.post} / reversal; mutating routes require
 * `Idempotency-Key` = `correlationId` (NovaPay money-API rules).
 * JWT required; admin / internal API policy is not enforced here yet.
 */
@Controller('ledger')
@ApiTags('ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
    return toLedgerTransactionResponse(tx);
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
    return toLedgerTransactionResponse(tx);
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
    return toLedgerTransactionResponse(tx);
  }
}
