import { Injectable } from '@nestjs/common';
import { Account } from '../../entities/account.entity';
import { AccountsService } from '../../service/accounts.service';
import { CreateAccountCommand } from '../impl/create-account.command';

@Injectable()
export class CreateAccountHandler {
  constructor(private readonly accounts: AccountsService) {}

  execute(command: CreateAccountCommand): Promise<Account> {
    return this.accounts.createAccount(command.dto);
  }
}
