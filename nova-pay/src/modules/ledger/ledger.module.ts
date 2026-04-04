import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { AccountsModule } from '../accounts/accounts.module';
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
 * Cross-module consumers use {@link PostingService} only; reads and reversals
 * stay inside this module (HTTP handlers + internal services).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerTransaction, LedgerEntry]),
    AccountsModule,
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
  ],
  exports: [PostingService],
})
export class LedgerModule {}
