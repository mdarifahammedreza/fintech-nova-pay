import { DynamicModule, Module, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

type Importable =
  | Type<unknown>
  | DynamicModule
  | Promise<DynamicModule>;

/**
 * Infrastructure roots (infrastructure/database, messaging, cache, …).
 * Add DatabaseModule, RabbitmqModule, RedisModule, etc. when implemented.
 */
const infrastructureImports: Importable[] = [];

/**
 * Feature module roots (modules/*).
 * Add AuthModule, UsersModule, AccountsModule, … when implemented.
 */
const featureModules: Importable[] = [];

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
