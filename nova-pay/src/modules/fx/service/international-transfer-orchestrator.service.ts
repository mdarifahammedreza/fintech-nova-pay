import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { CreateInternationalTransferDto } from '../dto/create-international-transfer.dto';
import { FxRateLock } from '../entities/fx-rate-lock.entity';
import { FxTrade } from '../entities/fx-trade.entity';
import { FxLockStatus } from '../enums/fx-lock-status.enum';
import { FxTradeStatus } from '../enums/fx-trade-status.enum';
import { FxTradeExecutedEvent } from '../events/fx-trade-executed.event';
import { InternationalTransferCreatedEvent } from '../events/international-transfer-created.event';
import { FxService } from './fx.service';

function multiplySourceByRateToTargetAmount(
  sourceAmount: string,
  lockedRate: string,
  fractionDigits: number,
): string {
  const a = Number.parseFloat(sourceAmount);
  const r = Number.parseFloat(lockedRate);
  if (!Number.isFinite(a) || !Number.isFinite(r)) {
    throw new BadRequestException('Invalid amount or rate for FX conversion');
  }
  return (a * r).toFixed(fractionDigits);
}

/**
 * Consumes a rate lock and materializes an {@link FxTrade} in the same DB
 * transaction. Payments and ledger are invoked only via their public services
 * (see TODOs below); this module does not touch payment or ledger tables
 * directly.
 */
@Injectable()
export class InternationalTransferOrchestratorService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly fxService: FxService,
    private readonly outbox: OutboxRepository,
  ) {}

  /**
   * One lock yields at most one trade row (DB unique on rate_lock_id). Lock is
   * marked CONSUMED with executedRate equal to lockedRate on the trade row.
   */
  async executeInternationalTransfer(
    userId: string,
    dto: CreateInternationalTransferDto,
  ): Promise<{ trade: FxTrade }> {
    return this.dataSource.transaction(async (manager) => {
      const lock = await this.fxService.assertLockConsumableWithLock(
        manager,
        userId,
        dto.rateLockId,
        dto.amount,
      );

      const existing = await manager.findOne(FxTrade, {
        where: { rateLockId: lock.id },
      });
      if (existing) {
        throw new ConflictException('Rate lock already consumed');
      }

      const targetAmount = multiplySourceByRateToTargetAmount(
        dto.amount,
        lock.lockedRate,
        4,
      );

      lock.status = FxLockStatus.CONSUMED;
      lock.consumedAt = new Date();
      await manager.save(lock);

      const trade = manager.create(FxTrade, {
        userId,
        rateLockId: lock.id,
        sourceAmount: dto.amount,
        sourceCurrency: lock.sourceCurrency,
        targetAmount,
        targetCurrency: lock.targetCurrency,
        executedRate: lock.lockedRate,
        provider: lock.provider,
        providerReference: lock.providerReference,
        status: FxTradeStatus.PENDING,
      });
      await manager.save(trade);

      const occurredAt = new Date();
      const occurredIso = occurredAt.toISOString();
      const corr = dto.correlationId ?? null;

      const tradeEvt = new FxTradeExecutedEvent(
        trade.id,
        lock.id,
        userId,
        dto.reference,
        corr,
        dto.idempotencyKey,
        trade.providerReference,
        trade.sourceAmount,
        trade.sourceCurrency,
        trade.targetAmount,
        trade.targetCurrency,
        trade.executedRate,
        trade.provider,
        trade.status,
        occurredIso,
      );
      await this.outbox.enqueueInTransaction(manager, {
        routingKey: OutboxRoutingKey.FX_TRADE_EXECUTED,
        correlationId: corr,
        occurredAt,
        payload: tradeEvt.toJSON(),
      });

      const intlEvt = new InternationalTransferCreatedEvent(
        trade.id,
        lock.id,
        userId,
        dto.reference,
        corr,
        dto.idempotencyKey,
        dto.idempotencyScopeKey ?? null,
        dto.sourceAccountId,
        dto.destinationAccountId,
        dto.amount,
        lock.sourceCurrency,
        lock.targetCurrency,
        occurredIso,
      );
      await this.outbox.enqueueInTransaction(manager, {
        routingKey: OutboxRoutingKey.FX_INTERNATIONAL_TRANSFER_CREATED,
        correlationId: corr,
        occurredAt,
        payload: intlEvt.toJSON(),
      });

      // TODO: Call PostingService.postWithSharedManager(manager, ledgerDto) with
      // entries spanning source/destination accounts and currencies; set
      // ledgerDto.memo (or future metadata JSON) to include trade.id and
      // executedRate so cross-currency postings audit to the same locked rate.
      // TODO: Call PaymentOrchestratorService.submitPayment when a Payment row
      // must be created with idempotency from dto.idempotencyKey; today
      // submitPayment opens its own transaction, so either extend payments with
      // a shared-manager entry point or run payment after this TX commits.

      return { trade };
    });
  }
}
