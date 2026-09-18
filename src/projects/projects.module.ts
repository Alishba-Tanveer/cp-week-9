import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Project } from '../entities/Project';
import { ProjectMember } from '../entities/ProjectMember';
import { Task } from '../entities/Task';
import { User } from '../entities/User';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Project,
      ProjectMember,
      Task,
      User,
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, RolesGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
