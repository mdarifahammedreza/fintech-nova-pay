/**
 * Shared context shape for loan write handlers (actor, correlation, etc.).
 * Flesh out when commands are implemented.
 */
export type LoanCommandContext = {
  actorUserId: string;
};
