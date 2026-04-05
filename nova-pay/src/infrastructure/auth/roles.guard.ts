import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import type { JwtRequestUser } from './jwt-auth.guard';

/**
 * Requires JWT (`JwtAuthGuard` first) and a `role` claim matching one of the
 * handler/controller `@Roles(...)` values.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles == null || roles.length === 0) {
      return true;
    }
    const req = context
      .switchToHttp()
      .getRequest<{ user?: JwtRequestUser }>();
    const user = req.user;
    if (user == null) {
      throw new ForbiddenException('Authentication required');
    }
    if (!roles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role for this operation');
    }
    return true;
  }
}
