import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Project } from '../entities/Project';
import {
  ProjectMember,
  ProjectMemberRole,
} from '../entities/ProjectMember';
import { User } from '../entities/User';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
  ) {}

  async create(createProjectDto: CreateProjectDto): Promise<Project> {
    const owner = await this.userRepository.findOne({
      where: { id: createProjectDto.ownerId },
    });

    if (!owner) {
      throw new NotFoundException('Owner not found');
    }

    const project = this.projectRepository.create({
      name: createProjectDto.name,
      owner,
    });

    const savedProject = await this.projectRepository.save(project);

    const ownerMembership = this.projectMemberRepository.create({
      userId: owner.id,
      projectId: savedProject.id,
      role: ProjectMemberRole.OWNER,
    });

    await this.projectMemberRepository.save(ownerMembership);

    return savedProject;
  }

  async findAll(): Promise<Project[]> {
    return this.projectRepository.find({
      relations: {
        owner: true,
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async findById(id: number): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: {
        owner: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(
    id: number,
    updateProjectDto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (updateProjectDto.name !== undefined) {
      project.name = updateProjectDto.name;
    }

    return this.projectRepository.save(project);
  }

  async remove(id: number): Promise<void> {
    const project = await this.projectRepository.findOne({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.projectRepository.remove(project);
  }
}
