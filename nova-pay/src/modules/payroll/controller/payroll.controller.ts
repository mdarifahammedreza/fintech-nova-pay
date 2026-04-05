import {
  Body,
  ConflictException,
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
  ApiConflictResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { assertIdempotencyKeyMatchesBodyField } from '../../../common/utils/assert-idempotency-key-matches-body-field.util';
import { JwtAuthGuard } from '../../../infrastructure/auth/jwt-auth.guard';
import { CreatePayrollBatchHandler } from '../command/handlers/create-payroll-batch.handler';
import { ProcessPayrollBatchHandler } from '../command/handlers/process-payroll-batch.handler';
import { CreatePayrollBatchCommand } from '../command/impl/create-payroll-batch.command';
import { ProcessPayrollBatchCommand } from '../command/impl/process-payroll-batch.command';
import {
  CreatePayrollBatchResponseDto,
  GetPayrollBatchResponseDto,
  PayrollBatchResponseDto,
  toCreatePayrollBatchResponseDto,
  toGetPayrollBatchResponseDto,
  toPayrollBatchResponseDto,
} from '../dto/payroll-batch-http.dto';
import { CreatePayrollBatchDto } from '../dto/create-payroll-batch.dto';
import {
  PayrollJobCompletionReportResponseDto,
  PayrollJobStatusResponseDto,
  toPayrollJobCompletionReportResponseDto,
  toPayrollJobStatusResponseDto,
} from '../dto/payroll-job-read.dto';
import { ProcessPayrollBatchDto } from '../dto/process-payroll-batch.dto';
import { GetPayrollBatchByIdHandler } from '../query/handlers/get-payroll-batch-by-id.handler';
import { GetPayrollJobCompletionReportHandler } from '../query/handlers/get-payroll-job-completion-report.handler';
import { GetPayrollJobStatusHandler } from '../query/handlers/get-payroll-job-status.handler';
import { GetPayrollBatchByIdQuery } from '../query/impl/get-payroll-batch-by-id.query';
import { GetPayrollJobCompletionReportQuery } from '../query/impl/get-payroll-job-completion-report.query';
import { GetPayrollJobStatusQuery } from '../query/impl/get-payroll-job-status.query';

/**
 * Payroll HTTP surface — transport only; command/query handlers own use cases.
 *
 * **Canonical product paths (job id equals payroll_batches.id):**
 * - `POST /payroll/jobs` — create/upload batch (same body as `POST /payroll/batches`)
 * - `GET /payroll/jobs/:jobId` — job status (progress and counts)
 * - `GET /payroll/jobs/:jobId/report` — completion report (terminal batches only)
 *
 * **Aliases** (same handlers): `POST /payroll/batches`, `GET /payroll/batches/:id`,
 * `GET /payroll/batches/:batchId/status`, `GET /payroll/batches/:batchId/report`,
 * `POST .../batches/:id/process` and `POST .../jobs/:jobId/process`.
 */
@Controller('payroll')
@ApiTags('payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(
    private readonly createPayrollBatchHandler: CreatePayrollBatchHandler,
    private readonly processPayrollBatchHandler: ProcessPayrollBatchHandler,
    private readonly getPayrollBatchByIdHandler: GetPayrollBatchByIdHandler,
    private readonly getPayrollJobStatusHandler: GetPayrollJobStatusHandler,
    private readonly getPayrollJobCompletionReportHandler: GetPayrollJobCompletionReportHandler,
  ) {}

  @Post('jobs')
  @ApiOperation({
    summary: 'Create payroll job (batch + lines)',
    description:
      'Canonical create/upload entrypoint. Same as POST /payroll/batches.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Must match idempotencyKey in the body',
  })
  @ApiBody({ type: CreatePayrollBatchDto })
  @ApiOkResponse({ type: CreatePayrollBatchResponseDto })
  createJob(
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() dto: CreatePayrollBatchDto,
  ): Promise<CreatePayrollBatchResponseDto> {
    return this.createBatch(idempotencyKeyHeader, dto);
  }

  @Post('batches')
  @ApiOperation({
    summary: 'Create payroll batch with line items (idempotent)',
    description: 'Alias of POST /payroll/jobs.',
  })
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
    return toCreatePayrollBatchResponseDto(result);
  }

  @Post('jobs/:jobId/process')
  @ApiOperation({
    summary: 'Process payroll job (fund + disburse)',
    description: 'Canonical process path. Same as POST /payroll/batches/:id/process.',
  })
  @ApiParam({ name: 'jobId', format: 'uuid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Must match idempotencyKey in the body',
  })
  @ApiBody({ type: ProcessPayrollBatchDto })
  @ApiOkResponse({ type: PayrollBatchResponseDto })
  processJob(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() dto: ProcessPayrollBatchDto,
  ): Promise<PayrollBatchResponseDto> {
    return this.processBatch(jobId, idempotencyKeyHeader, dto);
  }

  @Post('batches/:id/process')
  @ApiOperation({
    summary: 'Process payroll batch (fund + disburse)',
    description: 'Alias of POST /payroll/jobs/:jobId/process.',
  })
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
    return toPayrollBatchResponseDto(batch);
  }

  @Get('jobs/:jobId')
  @ApiOperation({
    summary: 'Get payroll job status',
    description:
      'Progress, counts, and funding flags. jobId is the batch UUID.',
  })
  @ApiParam({ name: 'jobId', format: 'uuid' })
  @ApiOkResponse({ type: PayrollJobStatusResponseDto })
  getJobStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<PayrollJobStatusResponseDto> {
    return this.resolveJobStatus(jobId);
  }

  @Get('batches/:batchId/status')
  @ApiOperation({
    summary: 'Get payroll batch status (alias)',
    description: 'Same response as GET /payroll/jobs/:jobId.',
  })
  @ApiParam({ name: 'batchId', format: 'uuid' })
  @ApiOkResponse({ type: PayrollJobStatusResponseDto })
  getBatchStatus(
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ): Promise<PayrollJobStatusResponseDto> {
    return this.resolveJobStatus(batchId);
  }

  @Get('jobs/:jobId/report')
  @ApiOperation({
    summary: 'Get payroll completion report',
    description:
      'Totals, success/failure counts, and per-line failure details. ' +
      'Available when batch status is COMPLETED or FAILED.',
  })
  @ApiParam({ name: 'jobId', format: 'uuid' })
  @ApiOkResponse({ type: PayrollJobCompletionReportResponseDto })
  @ApiConflictResponse({
    description: 'Batch is not in a terminal state yet',
  })
  async getJobReport(
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<PayrollJobCompletionReportResponseDto> {
    return this.resolveJobReport(jobId);
  }

  @Get('batches/:batchId/report')
  @ApiOperation({
    summary: 'Get payroll completion report (alias)',
    description: 'Same as GET /payroll/jobs/:jobId/report.',
  })
  @ApiParam({ name: 'batchId', format: 'uuid' })
  @ApiOkResponse({ type: PayrollJobCompletionReportResponseDto })
  @ApiConflictResponse({
    description: 'Batch is not in a terminal state yet',
  })
  async getBatchReport(
    @Param('batchId', ParseUUIDPipe) batchId: string,
  ): Promise<PayrollJobCompletionReportResponseDto> {
    return this.resolveJobReport(batchId);
  }

  @Get('batches/:id')
  @ApiOperation({
    summary: 'Get payroll batch with all line items',
    description:
      'Full aggregate for support/UI. For progress-only polling prefer ' +
      'GET /payroll/jobs/:jobId or GET /payroll/batches/:id/status.',
  })
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
    return toGetPayrollBatchResponseDto(row.batch, row.items);
  }

  private async resolveJobStatus(
    jobId: string,
  ): Promise<PayrollJobStatusResponseDto> {
    const view = await this.getPayrollJobStatusHandler.execute(
      new GetPayrollJobStatusQuery(jobId),
    );
    if (!view) {
      throw new NotFoundException('Payroll job not found');
    }
    return toPayrollJobStatusResponseDto(view);
  }

  private async resolveJobReport(
    jobId: string,
  ): Promise<PayrollJobCompletionReportResponseDto> {
    const result = await this.getPayrollJobCompletionReportHandler.execute(
      new GetPayrollJobCompletionReportQuery(jobId),
    );
    if (result.kind === 'not_found') {
      throw new NotFoundException('Payroll job not found');
    }
    if (result.kind === 'not_terminal') {
      throw new ConflictException(
        `Payroll job is not finished (status=${result.batchStatus})`,
      );
    }
    return toPayrollJobCompletionReportResponseDto(result.report);
  }
}
