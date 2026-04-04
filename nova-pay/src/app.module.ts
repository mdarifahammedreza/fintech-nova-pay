import { DynamicModule, Module, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/database/database.module';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { OutboxRelayModule } from './infrastructure/outbox/outbox-relay.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { FraudModule } from './modules/fraud/fraud.module';
import { FxModule } from './modules/fx/fx.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { UsersModule } from './modules/users/users.module';

type Importable =
  | Type<unknown>
  | DynamicModule
  | Promise<DynamicModule>;

/**
 * Infrastructure roots (infrastructure/database, messaging, cache, …).
 * Set `OUTBOX_RELAY_MODULE_DISABLED=true` to omit RabbitMQ relay (e.g. CI
 * without `RABBITMQ_URL`); production should load {@link OutboxRelayModule}.
 */
const infrastructureImports: Importable[] = [
  DatabaseModule,
  OutboxModule,
  ...(process.env.OUTBOX_RELAY_MODULE_DISABLED === 'true'
    ? []
    : [OutboxRelayModule]),
];

/**
 * Feature module roots. `AuthModule` imports `UsersModule` for
 * {@link UsersService}; `UsersModule` is also listed here so user HTTP routes
 * and context wiring stay explicit at the app shell.
 */
const featureModules: Importable[] = [
  UsersModule,
  AuthModule,
  AccountsModule,
  LedgerModule,
  PaymentsModule,
  PayrollModule,
  FraudModule,
  FxModule,
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
