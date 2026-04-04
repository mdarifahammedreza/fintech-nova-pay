import { Injectable } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { UsersService } from '../../service/users.service';
import { GetUserByIdQuery } from '../impl/get-user-by-id.query';

@Injectable()
export class GetUserByIdHandler {
  constructor(private readonly users: UsersService) {}

  execute(query: GetUserByIdQuery): Promise<User | null> {
    return this.users.getUserById(query.id);
  }
}
