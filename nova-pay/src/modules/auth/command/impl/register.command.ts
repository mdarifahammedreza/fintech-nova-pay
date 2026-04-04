import { RegisterDto } from '../../dto/register.dto';

/**
 * Write-side command: self-service signup and token issuance.
 */
export class RegisterCommand {
  constructor(public readonly dto: RegisterDto) {}
}
