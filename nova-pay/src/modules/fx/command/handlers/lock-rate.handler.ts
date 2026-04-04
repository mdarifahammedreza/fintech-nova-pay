import { Injectable } from '@nestjs/common';
import { FxService } from '../../service/fx.service';
import { LockRateCommand } from '../impl/lock-rate.command';

@Injectable()
export class LockRateHandler {
  constructor(private readonly fx: FxService) {}

  execute(command: LockRateCommand) {
    return this.fx.lockRate(command.userId, command.dto);
  }
}
