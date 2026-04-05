import { Injectable } from '@nestjs/common';
import { Account } from '../../entities/account.entity';
import { AccountStatus } from '../../enums/account-status.enum';
import { AccountsService } from '../../service/accounts.service';
import { UnfreezeAccountCommand } from '../impl/unfreeze-account.command';

@Injectable()
export class UnfreezeAccountHandler {
  constructor(private readonly accounts: AccountsService) {}

  execute(command: UnfreezeAccountCommand): Promise<Account> {
    return this.accounts.updateAccountStatus(command.accountId, {
      status: AccountStatus.ACTIVE,
    });
  }
}
