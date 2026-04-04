import { Injectable } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { UsersService } from '../../service/users.service';
import { CreateUserCommand } from '../impl/create-user.command';

@Injectable()
export class CreateUserHandler {
  constructor(private readonly users: UsersService) {}

  execute(command: CreateUserCommand): Promise<User> {
    return this.users.createUser(command.dto);
  }
}
