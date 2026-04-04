import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './controller/users.controller';
import { GetUserByEmailHandler } from './query/handlers/get-user-by-email.handler';
import { GetUserByIdHandler } from './query/handlers/get-user-by-id.handler';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { UsersService } from './service/users.service';

/**
 * Users bounded context — persistence and public API for user identity data.
 * `UsersService` is exported for `AuthModule` (no cross-repository access).
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [
    UserRepository,
    UsersService,
    GetUserByEmailHandler,
    GetUserByIdHandler,
  ],
  exports: [UsersService],
})
export class UsersModule {}
