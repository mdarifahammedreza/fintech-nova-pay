import { CreateAccountDto } from '../../dto/create-account.dto';

/**
 * Write-side command: open a new account row (balances start at zero).
 */
export class CreateAccountCommand {
  constructor(public readonly dto: CreateAccountDto) {}
}
