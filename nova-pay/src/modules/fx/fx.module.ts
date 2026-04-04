import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
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
import { InternationalTransferOrchestratorService } from './service/international-transfer-orchestrator.service';

/**
 * FX bounded context — rate discovery, quote locks, and international transfer
 * orchestration. Ledger and payment settlement stay behind their own services.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FxRateLock, FxTrade]), OutboxModule],
  controllers: [FxController],
  providers: [
    FxRateLockRepository,
    FxTradeRepository,
    FxProviderService,
    FxService,
    InternationalTransferOrchestratorService,
    LockRateHandler,
    CreateInternationalTransferHandler,
    GetFxLockByIdHandler,
  ],
  exports: [
    TypeOrmModule,
    FxService,
    InternationalTransferOrchestratorService,
  ],
})
export class FxModule {}
