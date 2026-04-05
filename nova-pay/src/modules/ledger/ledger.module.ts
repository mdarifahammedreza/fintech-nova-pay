import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { PostLedgerTransactionHandler } from './command/handlers/post-ledger-transaction.handler';
import { ReverseLedgerTransactionHandler } from './command/handlers/reverse-ledger-transaction.handler';
import { LedgerController } from './controller/ledger.controller';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { LedgerTransaction } from './entities/ledger-transaction.entity';
import { GetLedgerTransactionByIdHandler } from './query/handlers/get-ledger-transaction-by-id.handler';
import { LedgerEntryRepository } from './repositories/ledger-entry.repository';
import { LedgerTransactionRepository } from './repositories/ledger-transaction.repository';
import { LedgerService } from './service/ledger.service';
import { PostingService } from './service/posting.service';
import { ReversalService } from './service/reversal.service';

/**
 * Ledger bounded context — postings, reversals, and reads via services.
 * Cross-module consumers use {@link PostingService} for writes and
 * {@link LedgerService} for supported reads (e.g. account statements).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerTransaction, LedgerEntry]),
    forwardRef(() => AccountsModule),
    AuthModule,
    OutboxModule,
  ],
  controllers: [LedgerController],
  providers: [
    LedgerTransactionRepository,
    LedgerEntryRepository,
    PostingService,
    ReversalService,
    LedgerService,
    PostLedgerTransactionHandler,
    ReverseLedgerTransactionHandler,
    GetLedgerTransactionByIdHandler,
    JwtAuthGuard,
  ],
  exports: [PostingService, LedgerService, ReverseLedgerTransactionHandler],
})
export class LedgerModule {}
