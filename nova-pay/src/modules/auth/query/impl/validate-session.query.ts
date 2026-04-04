/**
 * Read-side query: verify an access JWT and return identity claims.
 */
export class ValidateSessionQuery {
  constructor(public readonly accessToken: string) {}
}
