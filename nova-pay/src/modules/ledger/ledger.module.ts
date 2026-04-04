import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
 * Other modules should depend on exported services, not repositories.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LedgerTransaction, LedgerEntry])],
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
  exports: [LedgerService, PostingService, ReversalService],
})
export class LedgerModule {}
