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
import { assertIdempotencyKeyMatchesBodyField } from '../../../common/utils/assert-idempotency-key-matches-body-field.util';
import { CreatePayrollBatchHandler } from '../command/handlers/create-payroll-batch.handler';
import { ProcessPayrollBatchHandler } from '../command/handlers/process-payroll-batch.handler';
import { CreatePayrollBatchCommand } from '../command/impl/create-payroll-batch.command';
import { ProcessPayrollBatchCommand } from '../command/impl/process-payroll-batch.command';
import { CreatePayrollBatchDto } from '../dto/create-payroll-batch.dto';
import { ProcessPayrollBatchDto } from '../dto/process-payroll-batch.dto';
import { PayrollBatch } from '../entities/payroll-batch.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollBatchStatus } from '../enums/payroll-batch-status.enum';
import { PayrollItemStatus } from '../enums/payroll-item-status.enum';
import { GetPayrollBatchByIdHandler } from '../query/handlers/get-payroll-batch-by-id.handler';
import { GetPayrollBatchByIdQuery } from '../query/impl/get-payroll-batch-by-id.query';
import { CreatePayrollBatchResult } from '../service/payroll-orchestrator.service';

export class PayrollItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  batchId: string;

  @ApiProperty({ format: 'uuid' })
  employeeAccountId: string;

  @ApiProperty()
  amount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ enum: PayrollItemStatus })
  status: PayrollItemStatus;

  @ApiProperty()
  itemReference: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  paymentId: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  ledgerTransactionId: string | null;

  @ApiProperty({ nullable: true })
  memo: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PayrollBatchResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  employerAccountId: string;

  @ApiProperty()
  totalAmount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ enum: PayrollBatchStatus })
  status: PayrollBatchStatus;

  @ApiProperty()
  reference: string;

  @ApiProperty()
  idempotencyKey: string;

  @ApiProperty({ nullable: true })
  correlationId: string | null;

  @ApiProperty({ nullable: true })
  externalBatchRef: string | null;

  @ApiProperty({ nullable: true })
  memo: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CreatePayrollBatchResponseDto {
  @ApiProperty({ type: PayrollBatchResponseDto })
  batch: PayrollBatchResponseDto;

  @ApiProperty({ type: PayrollItemResponseDto, isArray: true })
  items: PayrollItemResponseDto[];

  @ApiProperty({
    description: 'False when this idempotency key already created the batch',
  })
  created: boolean;
}

export class GetPayrollBatchResponseDto {
  @ApiProperty({ type: PayrollBatchResponseDto })
  batch: PayrollBatchResponseDto;

  @ApiProperty({ type: PayrollItemResponseDto, isArray: true })
  items: PayrollItemResponseDto[];
}

function toItemResponse(
  i: PayrollItem,
  batchId: string,
): PayrollItemResponseDto {
  return {
    id: i.id,
    batchId,
    employeeAccountId: i.employeeAccountId,
    amount: i.amount,
    currency: i.currency,
    status: i.status,
    itemReference: i.itemReference,
    paymentId: i.paymentId,
    ledgerTransactionId: i.ledgerTransactionId,
    memo: i.memo,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

function toBatchResponse(b: PayrollBatch): PayrollBatchResponseDto {
  return {
    id: b.id,
    employerAccountId: b.employerAccountId,
    totalAmount: b.totalAmount,
    currency: b.currency,
    status: b.status,
    reference: b.reference,
    idempotencyKey: b.idempotencyKey,
    correlationId: b.correlationId,
    externalBatchRef: b.externalBatchRef,
    memo: b.memo,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function toCreateResponse(
  r: CreatePayrollBatchResult,
): CreatePayrollBatchResponseDto {
  return {
    batch: toBatchResponse(r.batch),
    items: r.items.map((i) => toItemResponse(i, r.batch.id)),
    created: r.created,
  };
}

/**
 * Payroll HTTP surface — transport only; handlers own use-case wiring.
 * TODO: JwtAuthGuard + employer / operator policy.
 */
@Controller('payroll')
@ApiTags('payroll')
@ApiBearerAuth()
export class PayrollController {
  constructor(
    private readonly createPayrollBatchHandler: CreatePayrollBatchHandler,
    private readonly processPayrollBatchHandler: ProcessPayrollBatchHandler,
    private readonly getPayrollBatchByIdHandler: GetPayrollBatchByIdHandler,
  ) {}

  @Post('batches')
  @ApiOperation({ summary: 'Create payroll batch with line items (idempotent)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Must match idempotencyKey in the body',
  })
  @ApiBody({ type: CreatePayrollBatchDto })
  @ApiOkResponse({ type: CreatePayrollBatchResponseDto })
  async createBatch(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() dto: CreatePayrollBatchDto,
  ): Promise<CreatePayrollBatchResponseDto> {
    assertIdempotencyKeyMatchesBodyField(
      idempotencyKeyHeader,
      dto.idempotencyKey,
      'idempotencyKey',
    );
    const result = await this.createPayrollBatchHandler.execute(
      new CreatePayrollBatchCommand(dto),
    );
    return toCreateResponse(result);
  }

  @Post('batches/:id/process')
  @ApiOperation({ summary: 'Process payroll batch (fund + disburse)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Must match idempotencyKey in the body',
  })
  @ApiBody({ type: ProcessPayrollBatchDto })
  @ApiOkResponse({ type: PayrollBatchResponseDto })
  async processBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() dto: ProcessPayrollBatchDto,
  ): Promise<PayrollBatchResponseDto> {
    assertIdempotencyKeyMatchesBodyField(
      idempotencyKeyHeader,
      dto.idempotencyKey,
      'idempotencyKey',
    );
    const batch = await this.processPayrollBatchHandler.execute(
      new ProcessPayrollBatchCommand(id, dto),
    );
    return toBatchResponse(batch);
  }

  @Get('batches/:id')
  @ApiOperation({ summary: 'Get payroll batch with items' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: GetPayrollBatchResponseDto })
  async getBatch(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GetPayrollBatchResponseDto> {
    const row = await this.getPayrollBatchByIdHandler.execute(
      new GetPayrollBatchByIdQuery(id),
    );
    if (!row) {
      throw new NotFoundException('Payroll batch not found');
    }
    return {
      batch: toBatchResponse(row.batch),
      items: row.items.map((i) => toItemResponse(i, row.batch.id)),
    };
  }
}
