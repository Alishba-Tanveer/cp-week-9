import 'dotenv/config';
import { DataSource } from 'typeorm';

import { RefreshToken } from '../entities/RefreshToken';
import { User } from '../entities/User';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, RefreshToken],
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false,
});