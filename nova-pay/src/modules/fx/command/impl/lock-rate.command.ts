import { LockRateDto } from '../../dto/lock-rate.dto';

/**
 * Command: create a time-bounded FX rate lock for the authenticated user.
 */
export class LockRateCommand {
  constructor(
    public readonly userId: string,
    public readonly dto: LockRateDto,
  ) {}
}
