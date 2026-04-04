import { Module } from '@nestjs/common';
import { PostgresModule } from './postgres/postgres.module';

/**
 * Database infrastructure entry — PostgreSQL via TypeORM.
 * Import `DatabaseModule` in `AppModule` (inside `infrastructureImports`).
 */
@Module({
  imports: [PostgresModule],
  exports: [PostgresModule],
})
export class DatabaseModule {}
