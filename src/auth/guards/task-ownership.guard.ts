import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ProjectMemberRole,
} from '../../entities/ProjectMember';
import { Task } from '../../entities/Task';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

interface AuthenticatedRequest {
  user?: JwtPayload;
  params: Record<string, string | undefined>;
  method: string;
  projectRole?: ProjectMemberRole;
}

@Injectable()
export class TaskOwnershipGuard implements CanActivate {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.method !== 'PATCH' && request.method !== 'DELETE') {
      return true;
    }

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (
      request.projectRole === ProjectMemberRole.OWNER ||
      request.projectRole === ProjectMemberRole.ADMIN
    ) {
      return true;
    }

    const taskId = Number(request.params.id);

    if (!Number.isInteger(taskId) || taskId <= 0) {
      throw new ForbiddenException(
        'Unable to determine task for authorization',
      );
    }

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new ForbiddenException(
        'You do not have permission to access this task',
      );
    }

    if (
      task.creatorId === user.sub ||
      task.assigneeId === user.sub
    ) {
      return true;
    }

    throw new ForbiddenException(
      'Only the task creator or assignee can modify this task',
    );
  }
}
