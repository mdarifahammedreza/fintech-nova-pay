import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { FxTrade } from '../entities/fx-trade.entity';

/** `fx_trades` persistence. */
@Injectable()
export class FxTradeRepository extends BaseRepository<FxTrade> {
  constructor(
    @InjectRepository(FxTrade)
    repository: Repository<FxTrade>,
  ) {
    super(repository);
  }

  findByRateLockId(rateLockId: string): Promise<FxTrade | null> {
    return this.findOneBy({ rateLockId });
  }

  findByIdAndUserId(id: string, userId: string): Promise<FxTrade | null> {
    return this.findOneBy({ id, userId });
  }
}
