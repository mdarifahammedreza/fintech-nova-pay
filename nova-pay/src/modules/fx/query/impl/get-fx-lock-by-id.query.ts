/**
 * Query: read FX lock status for one lock owned by the caller.
 */
export class GetFxLockByIdQuery {
  constructor(
    public readonly userId: string,
    public readonly lockId: string,
  ) {}
}
