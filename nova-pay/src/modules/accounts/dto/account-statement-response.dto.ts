import { ApiProperty } from '@nestjs/swagger';
import { LedgerEntryType } from '../../ledger/enums/ledger-entry-type.enum';
import { LedgerTransactionStatus } from '../../ledger/enums/ledger-transaction-status.enum';
import { LedgerTransactionType } from '../../ledger/enums/ledger-transaction-type.enum';
import { AccountLedgerStatementLineView } from '../../ledger/interfaces/account-ledger-statement-line.view';
import { Currency } from '../enums/currency.enum';

export class AccountStatementLineDto {
  @ApiProperty({ format: 'uuid' })
  ledgerEntryId: string;

  @ApiProperty({ format: 'uuid' })
  ledgerTransactionId: string;

  @ApiProperty({ description: 'Stable idempotency key for the ledger tx' })
  correlationId: string;

  @ApiProperty({ enum: LedgerTransactionType })
  transactionType: LedgerTransactionType;

  @ApiProperty({ enum: LedgerTransactionStatus })
  transactionStatus: LedgerTransactionStatus;

  @ApiProperty({ format: 'uuid', nullable: true })
  reversesTransactionId: string | null;

  @ApiProperty({ enum: LedgerEntryType })
  entryType: LedgerEntryType;

  @ApiProperty()
  amount: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty()
  lineNumber: number;

  @ApiProperty({ nullable: true })
  entryMemo: string | null;

  @ApiProperty({ nullable: true })
  transactionMemo: string | null;

  @ApiProperty()
  postedAt: Date;
}

export class AccountStatementResponseDto {
  @ApiProperty({ format: 'uuid' })
  accountId: string;

  @ApiProperty({ type: AccountStatementLineDto, isArray: true })
  lines: AccountStatementLineDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export function mapStatementLine(
  v: AccountLedgerStatementLineView,
): AccountStatementLineDto {
  return {
    ledgerEntryId: v.ledgerEntryId,
    ledgerTransactionId: v.ledgerTransactionId,
    correlationId: v.correlationId,
    transactionType: v.transactionType,
    transactionStatus: v.transactionStatus,
    reversesTransactionId: v.reversesTransactionId,
    entryType: v.entryType,
    amount: v.amount,
    currency: v.currency,
    lineNumber: v.lineNumber,
    entryMemo: v.entryMemo,
    transactionMemo: v.transactionMemo,
    postedAt: v.postedAt,
  };
}

export function toAccountStatementResponseDto(
  accountId: string,
  result: {
    lines: AccountLedgerStatementLineView[];
    total: number;
    page: number;
    limit: number;
  },
): AccountStatementResponseDto {
  return {
    accountId,
    lines: result.lines.map(mapStatementLine),
    total: result.total,
    page: result.page,
    limit: result.limit,
  };
}
