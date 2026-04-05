import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { AuthModule } from '../auth/auth.module';
import { CreateAccountHandler } from './command/handlers/create-account.handler';
import { AccountsController } from './controller/accounts.controller';
import { Account } from './entities/account.entity';
import { GetAccountByIdHandler } from './query/handlers/get-account-by-id.handler';
import { GetUserAccountsHandler } from './query/handlers/get-user-accounts.handler';
import { AccountRepository } from './repositories/account.repository';
import { AccountsService } from './service/accounts.service';

/**
 * Accounts bounded context — persistence and HTTP via handlers + service.
 * Other modules use exported {@link AccountsService} only (no repo imports).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Account]), OutboxModule, AuthModule],
  controllers: [AccountsController],
  providers: [
    AccountRepository,
    AccountsService,
    CreateAccountHandler,
    GetAccountByIdHandler,
    GetUserAccountsHandler,
    JwtAuthGuard,
  ],
  exports: [AccountsService],
})
export class AccountsModule {}
