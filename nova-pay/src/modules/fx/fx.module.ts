import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CreateInternationalTransferHandler } from './command/handlers/create-international-transfer.handler';
import { LockRateHandler } from './command/handlers/lock-rate.handler';
import { FxController } from './controller/fx.controller';
import { FxRateLock } from './entities/fx-rate-lock.entity';
import { FxTrade } from './entities/fx-trade.entity';
import { GetFxLockByIdHandler } from './query/handlers/get-fx-lock-by-id.handler';
import { FxRateLockRepository } from './repositories/fx-rate-lock.repository';
import { FxTradeRepository } from './repositories/fx-trade.repository';
import { FxProviderService } from './service/fx-provider.service';
import { FxService } from './service/fx.service';
import { FxLockExpiryCronService } from './service/fx-lock-expiry-cron.service';
import { FxLockExpirySweepService } from './service/fx-lock-expiry-sweep.service';
import { InternationalTransferOrchestratorService } from './service/international-transfer-orchestrator.service';

/**
 * FX bounded context — rate discovery, quote locks, and international transfer
 * orchestration. Settlement consumes {@link PostingService} from
 * {@link LedgerModule} only (no ledger repositories).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FxRateLock, FxTrade]),
    OutboxModule,
    AuthModule,
    LedgerModule,
  ],
  controllers: [FxController],
  providers: [
    FxRateLockRepository,
    FxTradeRepository,
    FxProviderService,
    FxService,
    InternationalTransferOrchestratorService,
    FxLockExpirySweepService,
    FxLockExpiryCronService,
    LockRateHandler,
    CreateInternationalTransferHandler,
    GetFxLockByIdHandler,
    JwtAuthGuard,
  ],
  exports: [
    TypeOrmModule,
    FxService,
    InternationalTransferOrchestratorService,
  ],
})
export class FxModule {}
