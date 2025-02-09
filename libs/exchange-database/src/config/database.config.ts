import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { RuneOrder } from '../entities/rune-order.entity';
import { Transaction } from '../entities/transaction.entity';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  return ({
    type: 'postgres',
    host: configService.get('DB_HOST', 'localhost'),
    port: configService.get('DB_PORT', 5432),
    username: configService.get('DB_USERNAME', 'postgres'),
    password: configService.get('DB_PASSWORD', 'postgres'),
    database: configService.get('DB_NAME', 'runepool-exchange'),
    entities: [RuneOrder,Transaction],
    synchronize: configService.get('NODE_ENV', 'development') !== 'production',
    logging: configService.get('DB_LOGGING', 'false') === 'true',
  });
}
