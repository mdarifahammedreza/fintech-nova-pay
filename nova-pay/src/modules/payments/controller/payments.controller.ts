import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { assertIdempotencyKeyMatchesBodyField } from '../../../common/utils/assert-idempotency-key-matches-body-field.util';
import type { Request } from 'express';
import {
  JwtAuthGuard,
  type JwtRequestUser,
} from '../../../infrastructure/auth/jwt-auth.guard';
import { CreatePaymentHandler } from '../command/handlers/create-payment.handler';
import { CreatePaymentCommand } from '../command/impl/create-payment.command';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import {
  PaymentResponseDto,
  toPaymentResponse,
} from '../dto/payment-response.dto';
import { GetPaymentByIdHandler } from '../query/handlers/get-payment-by-id.handler';
import { GetPaymentByReferenceHandler } from '../query/handlers/get-payment-by-reference.handler';
import { GetPaymentByIdQuery } from '../query/impl/get-payment-by-id.query';
import { GetPaymentByReferenceQuery } from '../query/impl/get-payment-by-reference.query';

type AuthedRequest = Request & { user: JwtRequestUser };

/**
 * Payments HTTP surface — writes go through orchestration; reads via
 * {@link PaymentsService} only. No direct balance mutation here.
 * JWT required; create-payment passes `jwt.sub` as actor (ownership enforced in
 * orchestration).
 */
@Controller('payments')
@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly createPaymentHandler: CreatePaymentHandler,
    private readonly getPaymentByIdHandler: GetPaymentByIdHandler,
    private readonly getPaymentByReferenceHandler: GetPaymentByReferenceHandler,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create / submit payment (idempotent, ledger-backed)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Must match `idempotencyKey` in the body (stable per logical attempt)',
  })
  @ApiBody({ type: CreatePaymentDto })
  @ApiOkResponse({ type: PaymentResponseDto })
  async create(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() dto: CreatePaymentDto,
    @Req() req: AuthedRequest,
  ): Promise<PaymentResponseDto> {
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

  @Get('lookup/by-reference')
  @ApiOperation({ summary: 'Get payment by business reference' })
  @ApiQuery({ name: 'reference', required: true, maxLength: 128 })
  @ApiOkResponse({ type: PaymentResponseDto })
  async getByReference(
    @Query('reference') reference?: string,
  ): Promise<PaymentResponseDto> {
    const v = reference?.trim();
    if (!v) {
      throw new BadRequestException('reference is required');
    }
    const payment = await this.getPaymentByReferenceHandler.execute(
      new GetPaymentByReferenceQuery(v),
    );
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return toPaymentResponse(payment);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get payment by id',
    description:
      'Includes `ledgerTransactionId` and `paymentLedgerCorrelationId` for ' +
      'joining to `GET /ledger/transactions/{ledgerTransactionId}` (see docs/transactions-api-mapping.md).',
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
      throw new NotFoundException('Payment not found');
    }
    return toPaymentResponse(payment);
  }
}
