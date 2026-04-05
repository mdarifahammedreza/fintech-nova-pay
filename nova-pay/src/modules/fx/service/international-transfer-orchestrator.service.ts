import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxRepository } from '../../../infrastructure/outbox/outbox.repository';
import { OutboxRoutingKey } from '../../../infrastructure/outbox/outbox-routing-key.enum';
import { Currency } from '../../accounts/enums/currency.enum';
import { PostLedgerTransactionDto } from '../../ledger/dto/post-ledger-transaction.dto';
import { LedgerEntryType } from '../../ledger/enums/ledger-entry-type.enum';
import { LedgerTransactionType } from '../../ledger/enums/ledger-transaction-type.enum';
import { PostingService } from '../../ledger/service/posting.service';
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

const LEDGER_MEMO_MAX = 512;

/** Serialized metadata on the ledger header `memo` (varchar cap). */
function buildFxLedgerMemo(
  trade: FxTrade,
  lock: FxRateLock,
  dto: CreateInternationalTransferDto,
): string {
  const payload = {
    fxTradeId: trade.id,
    rateLockId: lock.id,
    executedRate: trade.executedRate,
    reference: dto.reference,
    idempotencyKey: dto.idempotencyKey,
  };
  const s = JSON.stringify(payload);
  return s.length <= LEDGER_MEMO_MAX
    ? s
    : `${s.slice(0, LEDGER_MEMO_MAX - 3)}...`;
}

/**
 * International transfer orchestration: one PostgreSQL transaction for lock
 * consumption, trade row, ledger settlement, account projections, and outbox.
 *
 * Ledger: {@link PostingService.postWithSharedManager} posts
 * {@link LedgerTransactionType.FX_CONVERSION} (four legs: customer source,
 * house settlement per currency, customer destination). {@link PostingService}
 * also enqueues `ledger.transaction.posted` in that same transaction.
 *
 * Settlement account UUIDs: `FX_SETTLEMENT_ACCOUNT_<CURRENCY>` per leg currency.
 */
@Injectable()
export class InternationalTransferOrchestratorService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly fxService: FxService,
    private readonly posting: PostingService,
    private readonly outbox: OutboxRepository,
    private readonly config: ConfigService,
  ) {}

  /**
   * **Order (single TX):** validate lock under row lock → reject duplicate trade
   * for `rate_lock_id` → set lock `CONSUMED` → insert {@link FxTrade} as
   * `PENDING` → post FX ledger bundle (`correlationId` `fx:tr:<tradeId>`,
   * memo JSON with trade/lock/rate refs) → set trade `COMPLETED` → enqueue
   * `fx.trade.executed` and `fx.international_transfer.created`. Any failure
   * rolls back the whole flow including ledger lines and projections.
   *
   * @param userId Authenticated subject (`jwt.sub`); must own the lock
   * ({@link FxService.assertLockConsumableWithLock}).
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

      const sourceSettlementId = this.settlementAccountId(lock.sourceCurrency);
      const targetSettlementId = this.settlementAccountId(lock.targetCurrency);

      const ledgerDto: PostLedgerTransactionDto = {
        type: LedgerTransactionType.FX_CONVERSION,
        correlationId: `fx:tr:${trade.id}`,
        memo: buildFxLedgerMemo(trade, lock, dto),
        entries: [
          {
            accountId: dto.sourceAccountId,
            entryType: LedgerEntryType.DEBIT,
            amount: dto.amount,
            currency: lock.sourceCurrency,
          },
          {
            accountId: sourceSettlementId,
            entryType: LedgerEntryType.CREDIT,
            amount: dto.amount,
            currency: lock.sourceCurrency,
          },
          {
            accountId: targetSettlementId,
            entryType: LedgerEntryType.DEBIT,
            amount: targetAmount,
            currency: lock.targetCurrency,
          },
          {
            accountId: dto.destinationAccountId,
            entryType: LedgerEntryType.CREDIT,
            amount: targetAmount,
            currency: lock.targetCurrency,
          },
        ],
      };

      await this.posting.postWithSharedManager(manager, ledgerDto);

      trade.status = FxTradeStatus.COMPLETED;
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

      return { trade };
    });
  }

  /** House account id for the given currency leg (env `FX_SETTLEMENT_ACCOUNT_*`). */
  private settlementAccountId(currency: Currency): string {
    const key = `FX_SETTLEMENT_ACCOUNT_${currency}`;
    const raw = this.config.get<string>(key);
    if (raw == null || raw.trim() === '') {
      throw new BadRequestException(
        `FX ledger settlement is not configured (${key})`,
      );
    }
    return raw.trim();
  }
}
