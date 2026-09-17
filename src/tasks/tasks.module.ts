import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TaskOwnershipGuard } from '../auth/guards/task-ownership.guard';
import { Comment } from '../entities/Comment';
import { Project } from '../entities/Project';
import { ProjectMember } from '../entities/ProjectMember';
import { Tag } from '../entities/Tag';
import { Task } from '../entities/Task';
import { User } from '../entities/User';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Task,
      Comment,
      Project,
      ProjectMember,
      User,
      Tag,
    ]),
  ],
  controllers: [TasksController],
  providers: [TasksService, RolesGuard, TaskOwnershipGuard],
  exports: [TasksService],
})
export class TasksModule {}
