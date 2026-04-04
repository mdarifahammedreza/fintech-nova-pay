import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * PostgreSQL TypeORM registrations (default = write, `read` = replica).
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_WRITE_URL'),
        autoLoadEntities: true,
        synchronize:
          config.get<string>('DATABASE_SYNCHRONIZE', 'false') === 'true',
        logging: config.get<string>('DATABASE_LOGGING', 'false') === 'true',
      }),
    }),
    TypeOrmModule.forRootAsync({
      name: 'read',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_READ_URL'),
        autoLoadEntities: true,
        synchronize: false,
        logging: config.get<string>('DATABASE_LOGGING', 'false') === 'true',
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class PostgresModule {}
