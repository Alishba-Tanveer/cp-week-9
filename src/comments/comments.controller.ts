import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PositiveIntPipe } from '../common/pipes/positive-int.pipe';
import { ProjectMemberRole } from '../entities/ProjectMember';
import { CommentsQueryDto } from './dto/comments-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentsService } from './comments.service';

@Controller('tasks/:taskId/comments')
@UseGuards(RolesGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @Roles(
    ProjectMemberRole.OWNER,
    ProjectMemberRole.ADMIN,
    ProjectMemberRole.MEMBER,
  )
  async create(
    @Param('taskId', PositiveIntPipe) taskId: number,
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.create(taskId, {
      ...createCommentDto,
      authorId: user.sub,
    });
  }

  @Get()
  @Public()
  async findByTask(
    @Param('taskId', PositiveIntPipe) taskId: number,
    @Query() filters: CommentsQueryDto,
  ) {
    return this.commentsService.findByTask(taskId, filters);
  }
}
