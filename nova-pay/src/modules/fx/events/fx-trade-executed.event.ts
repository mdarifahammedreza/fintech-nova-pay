import { Currency } from '../../accounts/enums/currency.enum';
import { FxProvider } from '../enums/fx-provider.enum';
import { FxTradeStatus } from '../enums/fx-trade-status.enum';

export const FX_TRADE_EXECUTED_EVENT_NAME = 'fx.trade.executed' as const;

export type FxTradeExecutedEventName = typeof FX_TRADE_EXECUTED_EVENT_NAME;

/**
 * Emitted when an FX trade row is committed (rate consumed, trade
 * materialized). Outbox-only: same DB transaction as the trade insert / lock
 * consume; async relay delivers to subscribers.
 */
export class FxTradeExecutedEvent {
  constructor(
    public readonly tradeId: string,
    public readonly rateLockId: string,
    public readonly userId: string,
    public readonly reference: string,
    public readonly correlationId: string | null,
    public readonly idempotencyKey: string,
    public readonly providerReference: string | null,
    public readonly sourceAmount: string,
    public readonly sourceCurrency: Currency,
    public readonly targetAmount: string,
    public readonly targetCurrency: Currency,
    public readonly executedRate: string,
    public readonly provider: FxProvider,
    public readonly status: FxTradeStatus,
    public readonly occurredAt: string,
  ) {}

  get eventName(): FxTradeExecutedEventName {
    return FX_TRADE_EXECUTED_EVENT_NAME;
  }

  toJSON(): Record<string, unknown> {
    return {
      eventName: this.eventName,
      tradeId: this.tradeId,
      rateLockId: this.rateLockId,
      userId: this.userId,
      reference: this.reference,
      correlationId: this.correlationId,
      idempotencyKey: this.idempotencyKey,
      providerReference: this.providerReference,
      sourceAmount: this.sourceAmount,
      sourceCurrency: this.sourceCurrency,
      targetAmount: this.targetAmount,
      targetCurrency: this.targetCurrency,
      executedRate: this.executedRate,
      provider: this.provider,
      status: this.status,
      occurredAt: this.occurredAt,
    };
  }
}
