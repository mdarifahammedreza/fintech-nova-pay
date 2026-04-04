import { CreateUserDto } from '../../dto/create-user.dto';

/**
 * Write-side command: register a new user (persistence + password hashing
 * happen in {@link UsersService}).
 */
export class CreateUserCommand {
  constructor(public readonly dto: CreateUserDto) {}
}
