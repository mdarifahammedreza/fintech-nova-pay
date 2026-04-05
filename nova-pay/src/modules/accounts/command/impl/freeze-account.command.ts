/** Freeze an account (privileged write; emits `account.frozen` when newly frozen). */
export class FreezeAccountCommand {
  constructor(public readonly accountId: string) {}
}
