import { ApplyLoanDto } from '../../dto/apply-loan.dto';

export class ApplyLoanCommand {
  constructor(
    public readonly dto: ApplyLoanDto,
    public readonly actorUserId: string,
  ) {}
}
