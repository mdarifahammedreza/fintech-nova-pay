import { Injectable } from '@nestjs/common';
import { AccountLedgerStatementLineView } from '../../../ledger/interfaces/account-ledger-statement-line.view';
import { LedgerService } from '../../../ledger/service/ledger.service';
import { AccountsService } from '../../service/accounts.service';
import { GetAccountStatementQuery } from '../impl/get-account-statement.query';

export type AccountStatementResult = {
  accountId: string;
  lines: AccountLedgerStatementLineView[];
  total: number;
  page: number;
  limit: number;
} | null;

@Injectable()
export class GetAccountStatementHandler {
  constructor(
    private readonly accounts: AccountsService,
    private readonly ledger: LedgerService,
  ) {}

  async execute(
    query: GetAccountStatementQuery,
  ): Promise<AccountStatementResult> {
    const account = await this.accounts.getAccountByIdForOwner(
      query.accountId,
      query.callerUserId,
    );
    if (!account) {
      return null;
    }
    const page = await this.ledger.getAccountStatementPage(
      query.accountId,
      query.page,
      query.limit,
    );
    return {
      accountId: account.id,
      lines: page.lines,
      total: page.total,
      page: page.page,
      limit: page.limit,
    };
  }
}
