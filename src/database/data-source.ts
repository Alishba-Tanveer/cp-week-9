import 'dotenv/config';
import { DataSource } from 'typeorm';

import { Comment } from '../entities/Comment';
import { Project } from '../entities/Project';
import { ProjectMember } from '../entities/ProjectMember';
import { RefreshToken } from '../entities/RefreshToken';
import { Tag } from '../entities/Tag';
import { Task } from '../entities/Task';
import { User } from '../entities/User';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    User,
    RefreshToken,
    Project,
    ProjectMember,
    Task,
    Tag,
    Comment,
  ],
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false,
});
