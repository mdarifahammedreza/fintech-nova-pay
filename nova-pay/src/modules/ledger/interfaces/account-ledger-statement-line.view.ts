import { Currency } from '../../accounts/enums/currency.enum';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';
import { LedgerTransactionStatus } from '../enums/ledger-transaction-status.enum';
import { LedgerTransactionType } from '../enums/ledger-transaction-type.enum';

/**
 * One ledger line for an account statement (immutable posting + header refs).
 */
export type AccountLedgerStatementLineView = {
  ledgerEntryId: string;
  ledgerTransactionId: string;
  correlationId: string;
  transactionType: LedgerTransactionType;
  transactionStatus: LedgerTransactionStatus;
  reversesTransactionId: string | null;
  entryType: LedgerEntryType;
  amount: string;
  currency: Currency;
  lineNumber: number;
  entryMemo: string | null;
  transactionMemo: string | null;
  postedAt: Date;
};
