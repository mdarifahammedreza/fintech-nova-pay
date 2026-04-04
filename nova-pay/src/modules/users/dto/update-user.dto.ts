import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * Partial update — same surface as create (no internal DB fields).
 * Omit `password` from the body when not rotating credentials.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}
