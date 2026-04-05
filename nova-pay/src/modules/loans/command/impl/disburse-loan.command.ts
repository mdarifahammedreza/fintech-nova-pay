import { DisburseLoanDto } from '../../dto/disburse-loan.dto';

export class DisburseLoanCommand {
  constructor(
    public readonly loanId: string,
    public readonly dto: DisburseLoanDto,
    public readonly actorUserId: string,
  ) {}
}
