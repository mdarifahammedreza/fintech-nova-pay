import { Injectable } from '@nestjs/common';
import { AuthService, AuthTokens } from '../../service/auth.service';
import { LoginCommand } from '../impl/login.command';

@Injectable()
export class LoginHandler {
  constructor(private readonly auth: AuthService) {}

  execute(command: LoginCommand): Promise<AuthTokens> {
    return this.auth.login(command.dto);
  }
}
