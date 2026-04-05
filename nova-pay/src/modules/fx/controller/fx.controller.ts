import {
  Body,
  Controller,
  Get,
  Headers,
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
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { assertIdempotencyKeyMatchesBodyField } from '../../../common/utils/assert-idempotency-key-matches-body-field.util';
import type { Request } from 'express';
import {
  JwtAuthGuard,
  type JwtRequestUser,
} from '../../../infrastructure/auth/jwt-auth.guard';
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

type AuthedRequest = Request & { user: JwtRequestUser };

export class FxLockStatusResponseDto {
  @ApiProperty({ format: 'uuid' })
  lockId: string;

  @ApiProperty({ enum: FxLockStatus })
  status: FxLockStatus;

  @ApiProperty()
  lockedRate: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Absolute expiry (server time); new locks use a canonical 60s lifetime',
  })
  expiresAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  consumedAt: Date | null;

  @ApiProperty({
    minimum: 0,
    example: 52,
    description:
      'Seconds until expiresAt from server evaluation time (60s lock TTL)',
  })
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
 * Lock and transfer ownership use JWT `sub` only (`X-User-Id` is not used).
 * Rate locks use a canonical **60-second** TTL from creation (`expiresAt`).
 */
@ApiTags('fx')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class FxController {
  constructor(
    private readonly lockRateHandler: LockRateHandler,
    private readonly getFxLockByIdHandler: GetFxLockByIdHandler,
    private readonly createInternationalTransferHandler: CreateInternationalTransferHandler,
  ) {}

  @Post('fx/lock-rate')
  @ApiOperation({
    summary: 'Create a time-bounded FX rate lock',
    description:
      'Persists an ACTIVE lock with `expiresAt` = now + **60 seconds** (canonical ' +
      'product TTL). Use `rateLockId` on the international transfer before expiry.',
  })
  @ApiBody({
    type: LockRateDto,
    description:
      'Currency pair and source amount; response includes `expiresAt` and ' +
      '`timeRemainingSeconds` derived from the 60s lock lifetime.',
  })
  @ApiOkResponse({ type: FxLockResponseDto })
  async lockRate(
    @Body() dto: LockRateDto,
    @Req() req: AuthedRequest,
  ): Promise<FxLockResponseDto> {
    return this.lockRateHandler.execute(
      new LockRateCommand(req.user.sub, dto),
    );
  }

  @Get('fx/lock/:id')
  @ApiOperation({
    summary: 'Get FX rate lock status by id',
    description:
      'Returns current status and remaining time until `expiresAt` (60s TTL from ' +
      'lock creation). After expiry the lock is no longer consumable.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Lock id' })
  @ApiOkResponse({ type: FxLockStatusResponseDto })
  async getLockById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthedRequest,
  ): Promise<FxLockStatusResponseDto> {
    const view = await this.getFxLockByIdHandler.execute(
      new GetFxLockByIdQuery(req.user.sub, id),
    );
    return toFxLockStatusResponse(view);
  }

  @Post('transfers/international')
  @ApiOperation({
    summary: 'Execute international transfer from an FX lock',
    description:
      'Consumes an ACTIVE lock that has not passed its `expiresAt` (**60s** after ' +
      'lock creation). Posts ledger settlement in the same database transaction.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Must exactly match body idempotencyKey',
  })
  @ApiBody({ type: CreateInternationalTransferDto })
  @ApiOkResponse({ type: InternationalTransferResponseDto })
  async createInternationalTransfer(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateInternationalTransferDto,
    @Req() req: AuthedRequest,
  ): Promise<InternationalTransferResponseDto> {
    assertIdempotencyKeyMatchesBodyField(
      idempotencyKey,
      dto.idempotencyKey,
      'idempotencyKey',
    );
    const { trade } = await this.createInternationalTransferHandler.execute(
      new CreateInternationalTransferCommand(req.user.sub, dto),
    );
    return toInternationalTransferResponse(trade);
  }
}
