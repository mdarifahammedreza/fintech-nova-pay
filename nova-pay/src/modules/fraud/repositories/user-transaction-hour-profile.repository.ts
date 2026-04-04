import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { UserTransactionHourProfile } from '../entities/user-transaction-hour-profile.entity';

/** `fraud_user_transaction_hour_profiles` persistence. */
@Injectable()
export class UserTransactionHourProfileRepository extends BaseRepository<UserTransactionHourProfile> {
  constructor(
    @InjectRepository(UserTransactionHourProfile)
    repository: Repository<UserTransactionHourProfile>,
  ) {
    super(repository);
  }
}
