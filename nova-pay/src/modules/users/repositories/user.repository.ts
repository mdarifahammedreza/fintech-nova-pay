import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../infrastructure/database/repositories/base.repository';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(
    @InjectRepository(User)
    repository: Repository<User>,
  ) {
    super(repository);
  }

  findById(id: string): Promise<User | null> {
    return this.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findOneBy({ email });
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.existsBy({ email });
  }
}
