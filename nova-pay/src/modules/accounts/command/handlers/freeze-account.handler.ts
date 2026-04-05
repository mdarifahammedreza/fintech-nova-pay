import { Injectable } from '@nestjs/common';
import { Account } from '../../entities/account.entity';
import { AccountStatus } from '../../enums/account-status.enum';
import { AccountsService } from '../../service/accounts.service';
import { FreezeAccountCommand } from '../impl/freeze-account.command';

@Injectable()
export class FreezeAccountHandler {
  constructor(private readonly accounts: AccountsService) {}

  execute(command: FreezeAccountCommand): Promise<Account> {
    return this.accounts.updateAccountStatus(command.accountId, {
      status: AccountStatus.FROZEN,
    });
  }
}
