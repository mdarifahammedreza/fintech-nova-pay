import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
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
import type { Request } from 'express';
import {
  JwtAuthGuard,
  type JwtRequestUser,
} from '../../../infrastructure/auth/jwt-auth.guard';
import { ReverseLedgerTransactionHandler } from '../../ledger/command/handlers/reverse-ledger-transaction.handler';
import { ReverseLedgerTransactionCommand } from '../../ledger/command/impl/reverse-ledger-transaction.command';
import {
  LedgerTransactionResponseDto,
  toLedgerTransactionResponse,
} from '../../ledger/dto/ledger-transaction-response.dto';
import { CreatePaymentHandler } from '../command/handlers/create-payment.handler';
import { CreatePaymentCommand } from '../command/impl/create-payment.command';
import { CreateTransactionIntentDto } from '../dto/create-transaction-intent.dto';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import {
  PaymentResponseDto,
  toPaymentResponse,
} from '../dto/payment-response.dto';
import { ReverseTransactionBodyDto } from '../dto/reverse-transaction-body.dto';
import { PaymentType } from '../enums/payment-type.enum';
import { GetPaymentByIdHandler } from '../query/handlers/get-payment-by-id.handler';
import { GetPaymentByIdQuery } from '../query/impl/get-payment-by-id.query';

type AuthedRequest = Request & { user: JwtRequestUser };

function toCreatePaymentDto(
  type: PaymentType,
  body: CreateTransactionIntentDto,
): CreatePaymentDto {
  return { ...body, type };
}

/**
 * Product **transaction** HTTP contract — thin aliases over existing payment and
 * ledger command handlers. Canonical mapping: `docs/transactions-api-mapping.md`.
 */
@Controller('transactions')
@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(
    private readonly createPaymentHandler: CreatePaymentHandler,
    private readonly getPaymentByIdHandler: GetPaymentByIdHandler,
    private readonly reverseLedgerHandler: ReverseLedgerTransactionHandler,
  ) {}

  @Post('transfer')
  @ApiOperation({
    summary: 'Transfer between accounts',
    description:
      'Same as `POST /payments` with `type: INTERNAL_TRANSFER` (payment + ledger path).',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Must match `idempotencyKey` in the body',
  })
  @ApiBody({ type: CreateTransactionIntentDto })
  @ApiOkResponse({ type: PaymentResponseDto })
  async transfer(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: CreateTransactionIntentDto,
    @Req() req: AuthedRequest,
  ): Promise<PaymentResponseDto> {
    return this.submitTypedPayment(
      PaymentType.INTERNAL_TRANSFER,
      body,
      idempotencyKeyHeader,
      req,
    );
  }

  @Post('deposit')
  @ApiOperation({
    summary: 'Deposit (collection) into caller-owned destination',
    description:
      'Same as `POST /payments` with `type: COLLECTION`. Caller must own the ' +
      '**destination** account; `sourceAccountId` is typically a funding/settlement leg.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Must match `idempotencyKey` in the body',
  })
  @ApiBody({ type: CreateTransactionIntentDto })
  @ApiOkResponse({ type: PaymentResponseDto })
  async deposit(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: CreateTransactionIntentDto,
    @Req() req: AuthedRequest,
  ): Promise<PaymentResponseDto> {
    return this.submitTypedPayment(
      PaymentType.COLLECTION,
      body,
      idempotencyKeyHeader,
      req,
    );
  }

  @Post('withdraw')
  @ApiOperation({
    summary: 'Withdraw (payout) from caller-owned source',
    description:
      'Same as `POST /payments` with `type: PAYOUT`. Caller must own the source account.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Must match `idempotencyKey` in the body',
  })
  @ApiBody({ type: CreateTransactionIntentDto })
  @ApiOkResponse({ type: PaymentResponseDto })
  async withdraw(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: CreateTransactionIntentDto,
    @Req() req: AuthedRequest,
  ): Promise<PaymentResponseDto> {
    return this.submitTypedPayment(
      PaymentType.PAYOUT,
      body,
      idempotencyKeyHeader,
      req,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get transaction (payment) by id',
    description:
      '`id` is **`payments.id`** (same as `GET /payments/:id`). Response includes ' +
      '`ledgerTransactionId` (when posted) and `paymentLedgerCorrelationId` ' +
      '(`payment:{id}`). Load line-level truth via `GET /ledger/transactions/{ledgerTransactionId}` ' +
      'when `ledgerTransactionId` is set. See `docs/transactions-api-mapping.md`.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PaymentResponseDto })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.getPaymentByIdHandler.execute(
      new GetPaymentByIdQuery(id),
    );
    if (!payment) {
      throw new NotFoundException('Transaction not found');
    }
    return toPaymentResponse(payment);
  }

  @Post(':id/reverse')
  @ApiOperation({
    summary: 'Reverse a posted ledger transaction',
    description:
      '`:id` is the **ledger transaction** id to reverse (same as ' +
      '`ReverseLedgerTransactionDto.originalLedgerTransactionId`). ' +
      'Delegates to `POST /ledger/reversals`.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Posted ledger_transactions.id to reverse',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Must match `correlationId` in the body',
  })
  @ApiBody({ type: ReverseTransactionBodyDto })
  @ApiOkResponse({ type: LedgerTransactionResponseDto })
  async reverse(
    @Param('id', ParseUUIDPipe) ledgerTransactionId: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: ReverseTransactionBodyDto,
  ): Promise<LedgerTransactionResponseDto> {
    assertIdempotencyKeyMatchesBodyField(
      idempotencyKeyHeader,
      body.correlationId,
      'correlationId',
    );
    const tx = await this.reverseLedgerHandler.execute(
      new ReverseLedgerTransactionCommand({
        originalLedgerTransactionId: ledgerTransactionId,
        correlationId: body.correlationId,
        memo: body.memo ?? undefined,
      }),
    );
    return toLedgerTransactionResponse(tx);
  }

  private async submitTypedPayment(
    type: PaymentType,
    body: CreateTransactionIntentDto,
    idempotencyKeyHeader: string | undefined,
    req: AuthedRequest,
  ): Promise<PaymentResponseDto> {
    const dto = toCreatePaymentDto(type, body);
    assertIdempotencyKeyMatchesBodyField(
      idempotencyKeyHeader,
      dto.idempotencyKey,
      'idempotencyKey',
    );
    const payment = await this.createPaymentHandler.execute(
      new CreatePaymentCommand(dto, req.user.sub),
    );
    return toPaymentResponse(payment);
  }
}
