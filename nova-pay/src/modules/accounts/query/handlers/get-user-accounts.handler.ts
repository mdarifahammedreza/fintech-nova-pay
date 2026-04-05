import { Injectable } from '@nestjs/common';
import { Account } from '../../entities/account.entity';
import { AccountsService } from '../../service/accounts.service';
import { GetUserAccountsQuery } from '../impl/get-user-accounts.query';

@Injectable()
export class GetUserAccountsHandler {
  constructor(private readonly accounts: AccountsService) {}

  execute(query: GetUserAccountsQuery): Promise<Account[]> {
    return this.accounts.getUserAccountsForCaller(
      query.userId,
      query.callerUserId,
    );
  }
}
