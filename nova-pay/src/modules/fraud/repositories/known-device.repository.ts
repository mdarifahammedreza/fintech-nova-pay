import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { KnownDevice } from '../entities/known-device.entity';

/** `fraud_known_devices` persistence. */
@Injectable()
export class KnownDeviceRepository extends BaseRepository<KnownDevice> {
  constructor(
    @InjectRepository(KnownDevice)
    repository: Repository<KnownDevice>,
  ) {
    super(repository);
  }
}
