import { Injectable } from '@nestjs/common';
import { Account } from '../../entities/account.entity';
import { AccountsService } from '../../service/accounts.service';
import { GetAccountByIdQuery } from '../impl/get-account-by-id.query';

@Injectable()
export class GetAccountByIdHandler {
  constructor(private readonly accounts: AccountsService) {}

  execute(query: GetAccountByIdQuery): Promise<Account | null> {
    return this.accounts.getAccountById(query.id);
  }
}
