import { Injectable } from '@nestjs/common';
import { AuthService } from '../../service/auth.service';
import { AccessJwtPayload } from '../../service/token.service';
import { ValidateSessionQuery } from '../impl/validate-session.query';

@Injectable()
export class ValidateSessionHandler {
  constructor(private readonly auth: AuthService) {}

  execute(query: ValidateSessionQuery): Promise<AccessJwtPayload> {
    return this.auth.validateAccessToken(query.accessToken);
  }
}
