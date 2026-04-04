import { CreateInternationalTransferDto } from '../../dto/create-international-transfer.dto';

/**
 * Command: consume a rate lock and record an FX trade (orchestrated path).
 */
export class CreateInternationalTransferCommand {
  constructor(
    public readonly userId: string,
    public readonly dto: CreateInternationalTransferDto,
  ) {}
}
