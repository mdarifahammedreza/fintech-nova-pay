import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

loadEnv({ path: ['.env.local', '.env'] });

const writeUrl = process.env.DATABASE_WRITE_URL;
if (!writeUrl) {
  throw new Error(
    'DATABASE_WRITE_URL is required (TypeORM CLI / data-source)',
  );
}

const useDist = process.env.TYPEORM_DATASOURCE_USE_DIST === 'true';
const codeRoot = useDist
  ? join(process.cwd(), 'dist')
  : join(process.cwd(), 'src');
const ext = useDist ? 'js' : 'ts';

const options: DataSourceOptions = {
  type: 'postgres',
  url: writeUrl,
  entities: [join(codeRoot, 'modules', '**', `*.entity.${ext}`)],
  migrations: [
    join(
      codeRoot,
      'infrastructure',
      'database',
      'migrations',
      `*.${ext}`,
    ),
  ],
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true',
  migrationsTableName: 'typeorm_migrations',
};

export default new DataSource(options);
