import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ProjectMember,
  ProjectMemberRole,
} from '../../entities/ProjectMember';
import { Task } from '../../entities/Task';
import { RoleCacheService } from '../services/role-cache.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,

    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,

    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<
      ProjectMemberRole[]
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: JwtPayload;
      params: Record<string, string | undefined>;
      body: Record<string, unknown>;
      projectRole?: ProjectMemberRole;
    }>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const projectId = await this.resolveProjectId(context, request);

    if (!projectId) {
      throw new ForbiddenException(
        'Unable to determine project for authorization',
      );
    }

    let role = RoleCacheService.get(user.sub, projectId);

    if (role === undefined) {
      const membership = await this.projectMemberRepository.findOne({
        where: {
          userId: user.sub,
          projectId,
        },
      });

      role = membership?.role ?? null;

      RoleCacheService.set(user.sub, projectId, role);
    }

    if (role === null) {
      throw new ForbiddenException(
        'You are not a member of this project',
      );
    }

    request.projectRole = role;

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }

  private async resolveProjectId(
    context: ExecutionContext,
    request: {
      params: Record<string, string | undefined>;
      body: Record<string, unknown>;
    },
  ): Promise<number | undefined> {
    const controllerName = context.getClass().name;
    const method = requestMethod(context);

    if (controllerName === 'ProjectsController') {
      return this.parsePositiveInteger(request.params.id);
    }

    if (controllerName === 'TasksController') {
      if (method === 'POST') {
        return this.parseBodyProjectId(request.body.projectId);
      }

      const taskId = this.parsePositiveInteger(request.params.id);

      if (!taskId) {
        return undefined;
      }

      const task = await this.taskRepository.findOne({
        where: { id: taskId },
      });

      return task?.projectId;
    }

    if (controllerName === 'CommentsController') {
      const taskId = this.parsePositiveInteger(request.params.taskId);

      if (!taskId) {
        return undefined;
      }

      const task = await this.taskRepository.findOne({
        where: { id: taskId },
      });

      return task?.projectId;
    }

    return undefined;
  }

  private parsePositiveInteger(
    value: string | undefined,
  ): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  private parseBodyProjectId(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Number.isInteger(value) && value > 0
        ? value
        : undefined;
    }

    if (typeof value === 'string') {
      return this.parsePositiveInteger(value);
    }

    return undefined;
  }
}

function requestMethod(context: ExecutionContext): string {
  return context
    .switchToHttp()
    .getRequest<{ method: string }>()
    .method;
}
