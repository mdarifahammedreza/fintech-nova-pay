import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
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
import { isUUID } from 'class-validator';
import { assertIdempotencyKeyMatchesBodyField } from '../../../common/utils/assert-idempotency-key-matches-body-field.util';
import { Currency } from '../../accounts/enums/currency.enum';
import { CreateInternationalTransferHandler } from '../command/handlers/create-international-transfer.handler';
import { LockRateHandler } from '../command/handlers/lock-rate.handler';
import { CreateInternationalTransferCommand } from '../command/impl/create-international-transfer.command';
import { LockRateCommand } from '../command/impl/lock-rate.command';
import { CreateInternationalTransferDto } from '../dto/create-international-transfer.dto';
import { FxLockResponseDto } from '../dto/fx-lock-response.dto';
import { LockRateDto } from '../dto/lock-rate.dto';
import { FxTrade } from '../entities/fx-trade.entity';
import { FxLockStatus } from '../enums/fx-lock-status.enum';
import { FxProvider } from '../enums/fx-provider.enum';
import { FxTradeStatus } from '../enums/fx-trade-status.enum';
import { GetFxLockByIdHandler } from '../query/handlers/get-fx-lock-by-id.handler';
import { GetFxLockByIdQuery } from '../query/impl/get-fx-lock-by-id.query';
import type { FxLockStatusView } from '../service/fx.service';

function requireUserIdHeader(value: string | undefined): string {
  const v = value?.trim();
  if (!v) {
    throw new BadRequestException('X-User-Id header is required');
  }
  if (!isUUID(v, '4')) {
    throw new BadRequestException('X-User-Id must be a UUID v4');
  }
  return v;
}

export class FxLockStatusResponseDto {
  @ApiProperty({ format: 'uuid' })
  lockId: string;

  @ApiProperty({ enum: FxLockStatus })
  status: FxLockStatus;

  @ApiProperty()
  lockedRate: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  consumedAt: Date | null;

  @ApiProperty({ minimum: 0 })
  timeRemainingSeconds: number;

  @ApiProperty({ enum: FxProvider })
  provider: FxProvider;
}

function toFxLockStatusResponse(view: FxLockStatusView): FxLockStatusResponseDto {
  return {
    lockId: view.lockId,
    status: view.status,
    lockedRate: view.lockedRate,
    expiresAt: view.expiresAt,
    consumedAt: view.consumedAt,
    timeRemainingSeconds: view.timeRemainingSeconds,
    provider: view.provider,
  };
}

export class InternationalTransferResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  rateLockId: string;

  @ApiProperty()
  sourceAmount: string;

  @ApiProperty({ enum: Currency })
  sourceCurrency: Currency;

  @ApiProperty()
  targetAmount: string;

  @ApiProperty({ enum: Currency })
  targetCurrency: Currency;

  @ApiProperty()
  executedRate: string;

  @ApiProperty({ enum: FxProvider })
  provider: FxProvider;

  @ApiProperty({ nullable: true })
  providerReference: string | null;

  @ApiProperty({ enum: FxTradeStatus })
  status: FxTradeStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

function toInternationalTransferResponse(
  trade: FxTrade,
): InternationalTransferResponseDto {
  return {
    id: trade.id,
    userId: trade.userId,
    rateLockId: trade.rateLockId,
    sourceAmount: trade.sourceAmount,
    sourceCurrency: trade.sourceCurrency,
    targetAmount: trade.targetAmount,
    targetCurrency: trade.targetCurrency,
    executedRate: trade.executedRate,
    provider: trade.provider,
    providerReference: trade.providerReference,
    status: trade.status,
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt,
  };
}

/**
 * FX HTTP surface: rate locks and international transfer initiation.
 * Caller identity is required via `X-User-Id` until JWT guards attach
 * `req.user.sub` on these routes.
 */
@ApiTags('fx')
@ApiBearerAuth()
@Controller()
export class FxController {
  constructor(
    private readonly lockRateHandler: LockRateHandler,
    private readonly getFxLockByIdHandler: GetFxLockByIdHandler,
    private readonly createInternationalTransferHandler: CreateInternationalTransferHandler,
  ) {}

  @Post('fx/lock-rate')
  @ApiOperation({ summary: 'Create a time-bounded FX rate lock' })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    description: 'Authenticated user id (UUID v4); must own subsequent transfers',
  })
  @ApiBody({ type: LockRateDto })
  @ApiOkResponse({ type: FxLockResponseDto })
  async lockRate(
    @Headers('x-user-id') xUserId: string | undefined,
    @Body() dto: LockRateDto,
  ): Promise<FxLockResponseDto> {
    const userId = requireUserIdHeader(xUserId);
    return this.lockRateHandler.execute(new LockRateCommand(userId, dto));
  }

  @Get('fx/lock/:id')
  @ApiOperation({ summary: 'Get FX rate lock status by id' })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    description: 'Must match the user who created the lock',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Lock id' })
  @ApiOkResponse({ type: FxLockStatusResponseDto })
  async getLockById(
    @Headers('x-user-id') xUserId: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FxLockStatusResponseDto> {
    const userId = requireUserIdHeader(xUserId);
    const view = await this.getFxLockByIdHandler.execute(
      new GetFxLockByIdQuery(userId, id),
    );
    return toFxLockStatusResponse(view);
  }

  @Post('transfers/international')
  @ApiOperation({ summary: 'Execute international transfer from an FX lock' })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    description: 'Must match the lock owner',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Must exactly match body idempotencyKey',
  })
  @ApiBody({ type: CreateInternationalTransferDto })
  @ApiOkResponse({ type: InternationalTransferResponseDto })
  async createInternationalTransfer(
    @Headers('x-user-id') xUserId: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateInternationalTransferDto,
  ): Promise<InternationalTransferResponseDto> {
    const userId = requireUserIdHeader(xUserId);
    assertIdempotencyKeyMatchesBodyField(
      idempotencyKey,
      dto.idempotencyKey,
      'idempotencyKey',
    );
    const { trade } = await this.createInternationalTransferHandler.execute(
      new CreateInternationalTransferCommand(userId, dto),
    );
    return toInternationalTransferResponse(trade);
  }
}
