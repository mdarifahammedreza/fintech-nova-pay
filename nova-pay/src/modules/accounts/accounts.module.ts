import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/auth/roles.guard';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CreateAccountHandler } from './command/handlers/create-account.handler';
import { FreezeAccountHandler } from './command/handlers/freeze-account.handler';
import { UnfreezeAccountHandler } from './command/handlers/unfreeze-account.handler';
import { AccountsController } from './controller/accounts.controller';
import { Account } from './entities/account.entity';
import { GetAccountBalanceHandler } from './query/handlers/get-account-balance.handler';
import { GetAccountByIdHandler } from './query/handlers/get-account-by-id.handler';
import { GetAccountStatementHandler } from './query/handlers/get-account-statement.handler';
import { GetUserAccountsHandler } from './query/handlers/get-user-accounts.handler';
import { AccountRepository } from './repositories/account.repository';
import { AccountsService } from './service/accounts.service';

/**
 * Accounts bounded context — persistence and HTTP via handlers + service.
 * Other modules use exported {@link AccountsService} only (no repo imports).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Account]),
    OutboxModule,
    AuthModule,
    forwardRef(() => LedgerModule),
  ],
  controllers: [AccountsController],
  providers: [
    AccountRepository,
    AccountsService,
    CreateAccountHandler,
    FreezeAccountHandler,
    UnfreezeAccountHandler,
    GetAccountByIdHandler,
    GetAccountBalanceHandler,
    GetAccountStatementHandler,
    GetUserAccountsHandler,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AccountsService],
})
export class AccountsModule {}
