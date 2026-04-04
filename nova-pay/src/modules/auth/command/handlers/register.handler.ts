import { Injectable } from '@nestjs/common';
import { AuthService, AuthTokens } from '../../service/auth.service';
import { RegisterCommand } from '../impl/register.command';

@Injectable()
export class RegisterHandler {
  constructor(private readonly auth: AuthService) {}

  execute(command: RegisterCommand): Promise<AuthTokens> {
    return this.auth.register(command.dto);
  }
}
