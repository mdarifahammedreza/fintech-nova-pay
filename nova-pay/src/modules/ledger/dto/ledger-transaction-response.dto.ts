import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../../accounts/enums/currency.enum';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { LedgerTransaction } from '../entities/ledger-transaction.entity';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';
import { LedgerTransactionStatus } from '../enums/ledger-transaction-status.enum';
import { LedgerTransactionType } from '../enums/ledger-transaction-type.enum';

export class LedgerEntryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  ledgerTransactionId: string;

  @ApiProperty({ format: 'uuid' })
  accountId: string;

  @ApiProperty({ enum: LedgerEntryType })
  entryType: LedgerEntryType;

  @ApiProperty()
  amount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty()
  lineNumber: number;

  @ApiProperty({ nullable: true })
  memo: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class LedgerTransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: LedgerTransactionType })
  type: LedgerTransactionType;

  @ApiProperty({ enum: LedgerTransactionStatus })
  status: LedgerTransactionStatus;

  @ApiProperty({ format: 'uuid', nullable: true })
  reversesTransactionId: string | null;

  @ApiProperty({ nullable: true })
  correlationId: string | null;

  @ApiProperty({ nullable: true })
  memo: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: LedgerEntryResponseDto, isArray: true })
  entries: LedgerEntryResponseDto[];
}

export function toLedgerEntryResponse(e: LedgerEntry): LedgerEntryResponseDto {
  return {
    id: e.id,
    ledgerTransactionId: e.ledgerTransactionId,
    accountId: e.accountId,
    entryType: e.entryType,
    amount: e.amount,
    currency: e.currency,
    lineNumber: e.lineNumber,
    memo: e.memo,
    createdAt: e.createdAt,
  };
}

export function toLedgerTransactionResponse(
  tx: LedgerTransaction,
): LedgerTransactionResponseDto {
  return {
    id: tx.id,
    type: tx.type,
    status: tx.status,
    reversesTransactionId: tx.reversesTransactionId,
    correlationId: tx.correlationId,
    memo: tx.memo,
    createdAt: tx.createdAt,
    entries: (tx.entries ?? []).map(toLedgerEntryResponse),
  };
}
