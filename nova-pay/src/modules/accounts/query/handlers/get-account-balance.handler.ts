import { Injectable } from '@nestjs/common';
import { AccountBalanceView } from '../../dto/account-balance-response.dto';
import { AccountsService } from '../../service/accounts.service';
import { GetAccountBalanceQuery } from '../impl/get-account-balance.query';

@Injectable()
export class GetAccountBalanceHandler {
  constructor(private readonly accounts: AccountsService) {}

  async execute(
    query: GetAccountBalanceQuery,
  ): Promise<AccountBalanceView | null> {
    const account = await this.accounts.getAccountByIdForOwner(
      query.accountId,
      query.callerUserId,
    );
    if (!account) {
      return null;
    }
    return {
      accountId: account.id,
      balance: account.balance,
      availableBalance: account.availableBalance,
      currency: account.currency,
      updatedAt: account.updatedAt,
    };
  }
}
