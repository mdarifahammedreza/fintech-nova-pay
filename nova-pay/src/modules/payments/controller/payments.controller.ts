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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Currency } from '../../accounts/enums/currency.enum';
import { CreatePaymentHandler } from '../command/handlers/create-payment.handler';
import { CreatePaymentCommand } from '../command/impl/create-payment.command';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentType } from '../enums/payment-type.enum';
import { GetPaymentByIdHandler } from '../query/handlers/get-payment-by-id.handler';
import { GetPaymentByReferenceHandler } from '../query/handlers/get-payment-by-reference.handler';
import { GetPaymentByIdQuery } from '../query/impl/get-payment-by-id.query';
import { GetPaymentByReferenceQuery } from '../query/impl/get-payment-by-reference.query';

export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: PaymentType })
  type: PaymentType;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty()
  reference: string;

  @ApiProperty({ format: 'uuid' })
  idempotencyRecordId: string;

  @ApiProperty({ format: 'uuid' })
  sourceAccountId: string;

  @ApiProperty({ format: 'uuid' })
  destinationAccountId: string;

  @ApiProperty()
  amount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ format: 'uuid', nullable: true })
  ledgerTransactionId: string | null;

  @ApiProperty({ nullable: true })
  correlationId: string | null;

  @ApiProperty({ nullable: true })
  memo: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

function assertIdempotencyHeaderMatchesBody(
  headerValue: string | undefined,
  bodyKey: string,
): void {
  const h = headerValue?.trim();
  if (!h) {
    throw new BadRequestException('Idempotency-Key header is required');
  }
  if (h !== bodyKey) {
    throw new BadRequestException(
      'Idempotency-Key header must exactly match body idempotencyKey',
    );
  }
}

function toPaymentResponse(p: Payment): PaymentResponseDto {
  return {
    id: p.id,
    type: p.type,
    status: p.status,
    reference: p.reference,
    idempotencyRecordId: p.idempotencyRecordId,
    sourceAccountId: p.sourceAccountId,
    destinationAccountId: p.destinationAccountId,
    amount: p.amount,
    currency: p.currency,
    ledgerTransactionId: p.ledgerTransactionId,
    correlationId: p.correlationId,
    memo: p.memo,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/**
 * Payments HTTP surface — writes go through orchestration; reads via
 * {@link PaymentsService} only. No direct balance mutation here.
 * TODO: `JwtAuthGuard` + ownership / limits.
 */
@Controller('payments')
@ApiTags('payments')
@ApiBearerAuth()
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
  ): Promise<PaymentResponseDto> {
    assertIdempotencyHeaderMatchesBody(idempotencyKeyHeader, dto.idempotencyKey);
    const payment = await this.createPaymentHandler.execute(
      new CreatePaymentCommand(dto),
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
  @ApiOperation({ summary: 'Get payment by id' })
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
