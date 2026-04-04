import { Injectable } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { UsersService } from '../../service/users.service';
import { GetUserByEmailQuery } from '../impl/get-user-by-email.query';

@Injectable()
export class GetUserByEmailHandler {
  constructor(private readonly users: UsersService) {}

  execute(query: GetUserByEmailQuery): Promise<User | null> {
    return this.users.getUserByEmail(query.email);
  }
}
