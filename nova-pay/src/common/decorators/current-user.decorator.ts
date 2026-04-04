import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Populated by auth guard / JWT strategy (`req.user`). Shape is app-defined.
 */
export type AuthPrincipal = Record<string, unknown> & {
  sub?: string;
};

type RequestWithUser = { user?: AuthPrincipal };

/**
 * Returns `req.user` or a single property when `data` is provided.
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthPrincipal | undefined,
    ctx: ExecutionContext,
  ): AuthPrincipal | unknown | undefined => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;
    if (!user) {
      return undefined;
    }
    if (data === undefined || data === null) {
      return user;
    }
    return user[data];
  },
);
