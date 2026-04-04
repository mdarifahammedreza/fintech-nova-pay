import { DynamicModule, Module, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { PaymentsModule } from './modules/payments/payments.module';

type Importable =
  | Type<unknown>
  | DynamicModule
  | Promise<DynamicModule>;

/**
 * Infrastructure roots (infrastructure/database, messaging, cache, …).
 */
const infrastructureImports: Importable[] = [DatabaseModule];

/**
 * Feature module roots (`UsersModule` is pulled in via `AuthModule`).
 */
const featureModules: Importable[] = [
  AuthModule,
  AccountsModule,
  LedgerModule,
  PaymentsModule,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ...infrastructureImports,
    ...featureModules,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
