import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, getMetadataArgsStorage } from 'typeorm';
import { jest } from '@jest/globals';

import { Project } from '../entities/Project';
import { Task } from '../entities/Task';
import { Comment } from '../entities/Comment';
import { User } from '../entities/User';
import { ProjectMember } from '../entities/ProjectMember';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectRepository: jest.Mocked<Repository<Project>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let projectMemberRepository: jest.Mocked<Repository<ProjectMember>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    projectRepository = module.get(getRepositoryToken(Project));
    userRepository = module.get(getRepositoryToken(User));
    projectMemberRepository = module.get(
      getRepositoryToken(ProjectMember),
    );
  });

  it('creates a project when the owner exists', async () => {
    const owner = {
      id: 1,
      name: 'Test User',
    } as User;

    const project = {
      id: 10,
      name: 'Test Project',
      owner,
    } as Project;

    userRepository.findOne.mockResolvedValue(owner);
    projectRepository.create.mockReturnValue(project);
    projectRepository.save.mockResolvedValue(project);

    const membership = {
      userId: 1,
      projectId: 10,
      role: 'owner',
    } as ProjectMember;

    projectMemberRepository.create.mockReturnValue(membership);
    projectMemberRepository.save.mockResolvedValue(membership);

    const result = await service.create({
      name: 'Test Project',
      ownerId: 1,
    });

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(projectRepository.create).toHaveBeenCalledWith({
      name: 'Test Project',
      owner,
    });
    expect(projectRepository.save).toHaveBeenCalledWith(project);
    expect(projectMemberRepository.create).toHaveBeenCalledWith({
      userId: 1,
      projectId: 10,
      role: 'owner',
    });
    expect(projectMemberRepository.save).toHaveBeenCalledWith(membership);
    expect(result).toEqual(project);
  });

  it('throws NotFoundException when creating with a missing owner', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create({
        name: 'Test Project',
        ownerId: 999,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(projectRepository.create).not.toHaveBeenCalled();
    expect(projectRepository.save).not.toHaveBeenCalled();
  });

  it('returns all projects', async () => {
    const projects = [
      {
        id: 1,
        name: 'Project One',
      },
      {
        id: 2,
        name: 'Project Two',
      },
    ] as Project[];

    projectRepository.find.mockResolvedValue(projects);

    const result = await service.findAll();

    expect(projectRepository.find).toHaveBeenCalledWith({
      relations: {
        owner: true,
      },
      order: {
        id: 'ASC',
      },
    });
    expect(result).toEqual(projects);
  });

  it('maps a mocked project row to the expected response shape', async () => {
    const owner = {
      id: 1,
      name: 'Test User',
    } as User;

    const project = {
      id: 10,
      name: 'Mapped Project',
      owner,
      ownerId: 1,
    } as Project;

    projectRepository.findOne.mockResolvedValue(project);

    const result = await service.findById(10);

    expect(result).toEqual({
      id: 10,
      name: 'Mapped Project',
      owner,
      ownerId: 1,
    });

    expect(result.id).toBe(10);
    expect(result.name).toBe('Mapped Project');
    expect(result.owner).toEqual(owner);
    expect(result.ownerId).toBe(1);
  });

  it('throws NotFoundException when finding a missing project', async () => {
    projectRepository.findOne.mockResolvedValue(null);

    await expect(service.findById(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(projectRepository.findOne).toHaveBeenCalledWith({
      where: { id: 999 },
      relations: {
        owner: true,
      },
    });
  });

  it('updates a project when it exists', async () => {
    const owner = {
      id: 1,
      name: 'Test User',
    } as User;

    const project = {
      id: 10,
      name: 'Old Name',
      owner,
    } as Project;

    projectRepository.findOne.mockResolvedValue(project);
    projectRepository.save.mockResolvedValue({
      ...project,
      name: 'New Name',
    } as Project);

    const result = await service.update(10, {
      name: 'New Name',
    });

    expect(project.name).toBe('New Name');
    expect(projectRepository.save).toHaveBeenCalledWith(project);
    expect(result.name).toBe('New Name');
  });

  it('removes a project and verifies task/comment cascade configuration', async () => {
    const project = {
      id: 10,
      name: 'Test Project',
    } as Project;

    projectRepository.findOne.mockResolvedValue(project);
    projectRepository.remove.mockResolvedValue(project);

    await service.remove(10);

    expect(projectRepository.findOne).toHaveBeenCalledWith({
      where: { id: 10 },
    });
    expect(projectRepository.remove).toHaveBeenCalledWith(project);

    const storage = getMetadataArgsStorage();

    const taskProjectRelation = storage.relations.find(
      relation =>
        relation.target === Task &&
        relation.propertyName === 'project',
    );

    const commentTaskRelation = storage.relations.find(
      relation =>
        relation.target === Comment &&
        relation.propertyName === 'task',
    );

    expect(taskProjectRelation).toBeDefined();
    expect(commentTaskRelation).toBeDefined();
    expect(taskProjectRelation?.options?.onDelete).toBe('CASCADE');
    expect(commentTaskRelation?.options?.onDelete).toBe('CASCADE');
  });
});
