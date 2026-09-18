import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PositiveIntPipe } from '../common/pipes/positive-int.pipe';
import { ProjectMemberRole } from '../entities/ProjectMember';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectsService.create({
      ...createProjectDto,
      ownerId: user.sub,
    });
  }

  @Get()
  @Public()
  async findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @Public()
  async findById(@Param('id', PositiveIntPipe) id: number) {
    return this.projectsService.findById(id);
  }

  @Patch(':id')
  @Roles(ProjectMemberRole.OWNER, ProjectMemberRole.ADMIN)
  async update(
    @Param('id', PositiveIntPipe) id: number,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(ProjectMemberRole.OWNER, ProjectMemberRole.ADMIN)
  async remove(@Param('id', PositiveIntPipe) id: number): Promise<void> {
    await this.projectsService.remove(id);
  }
}
