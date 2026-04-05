import { RepayLoanDto } from '../../dto/repay-loan.dto';

export class RepayLoanCommand {
  constructor(
    public readonly loanId: string,
    public readonly dto: RepayLoanDto,
    public readonly actorUserId: string,
  ) {}
}
