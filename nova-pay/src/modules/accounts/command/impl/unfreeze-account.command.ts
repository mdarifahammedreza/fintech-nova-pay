/** Unfreeze an account (privileged write; emits `account.unfrozen` when leaving FROZEN). */
export class UnfreezeAccountCommand {
  constructor(public readonly accountId: string) {}
}
