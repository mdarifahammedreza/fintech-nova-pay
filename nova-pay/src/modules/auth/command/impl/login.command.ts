import { LoginDto } from '../../dto/login.dto';

/**
 * Write-side command: authenticate credentials and issue tokens.
 */
export class LoginCommand {
  constructor(public readonly dto: LoginDto) {}
}
