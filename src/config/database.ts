import dotenv from 'dotenv';
dotenv.config();

import { Sequelize } from 'sequelize';
import logger, { createChildLogger } from '../utils/logger.js';

const dbLogger = createChildLogger('database');

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: (msg) => dbLogger.debug(msg),
      pool: {
        max: 20,
        min: 2,
        acquire: 30000,
        idle: 10000,
      },
      define: {
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    })
  : new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'whatsapp_logger',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || undefined,
      logging: (msg) => dbLogger.debug(msg),
      pool: {
        max: 20,
        min: 2,
        acquire: 30000,
        idle: 10000,
      },
      define: {
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    });

export async function testConnection(): Promise<void> {
  try {
    await sequelize.authenticate();
    dbLogger.info('Database connection established successfully');
  } catch (error) {
    dbLogger.error({ error }, 'Unable to connect to the database');
    throw error;
  }
}

export { sequelize };
export default sequelize;
