import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TaskOwnershipGuard } from '../auth/guards/task-ownership.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PositiveIntPipe } from '../common/pipes/positive-int.pipe';
import { ProjectMemberRole } from '../entities/ProjectMember';
import { CreateTaskDto } from './dto/create-task.dto';
import { TasksQueryDto } from './dto/tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(RolesGuard, TaskOwnershipGuard)
export class TasksController {
  constructor(
    @Inject(TasksService)
    private readonly tasksService: TasksService,
  ) {}

  @Post()
  @Roles(
    ProjectMemberRole.OWNER,
    ProjectMemberRole.ADMIN,
    ProjectMemberRole.MEMBER,
  )
  create(
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.create(createTaskDto, user.sub);
  }

  @Get()
  @Public()
  findAll(@Query() filters: TasksQueryDto) {
    return this.tasksService.findAll(filters);
  }

  @Get(':id')
  @Public()
  findById(@Param('id', PositiveIntPipe) id: number) {
    return this.tasksService.findById(id);
  }

  @Patch(':id')
  @Roles(
    ProjectMemberRole.OWNER,
    ProjectMemberRole.ADMIN,
    ProjectMemberRole.MEMBER,
  )
  update(
    @Param('id', PositiveIntPipe) id: number,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(
    ProjectMemberRole.OWNER,
    ProjectMemberRole.ADMIN,
    ProjectMemberRole.MEMBER,
  )
  async remove(@Param('id', PositiveIntPipe) id: number): Promise<void> {
    await this.tasksService.remove(id);
  }
}
