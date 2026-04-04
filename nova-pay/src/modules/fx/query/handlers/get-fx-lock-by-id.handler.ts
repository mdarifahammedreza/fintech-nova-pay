import { Injectable } from '@nestjs/common';
import { FxService } from '../../service/fx.service';
import { GetFxLockByIdQuery } from '../impl/get-fx-lock-by-id.query';

@Injectable()
export class GetFxLockByIdHandler {
  constructor(private readonly fx: FxService) {}

  execute(query: GetFxLockByIdQuery) {
    return this.fx.getLockStatus(query.userId, query.lockId);
  }
}
