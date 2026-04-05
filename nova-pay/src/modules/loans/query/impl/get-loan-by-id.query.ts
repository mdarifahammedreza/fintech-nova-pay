export class GetLoanByIdQuery {
  constructor(
    public readonly loanId: string,
    public readonly actorUserId: string,
  ) {}
}
