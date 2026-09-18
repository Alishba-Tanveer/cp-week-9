import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { jest } from '@jest/globals';
import { Repository } from 'typeorm';

import { Project } from '../entities/Project';
import { Tag } from '../entities/Tag';
import { Task } from '../entities/Task';
import { User } from '../entities/User';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;

  const getRawAndEntities = jest.fn<
    () => Promise<{
      entities: Task[];
      raw: Array<{ task_commentCount?: string }>;
    }>
  >();

  const queryBuilder = {
    leftJoinAndSelect: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest.fn(),
    getRawAndEntities,
  };

  const createQueryBuilder = jest.fn(() => queryBuilder);

  beforeEach(async () => {
    jest.clearAllMocks();

    queryBuilder.leftJoinAndSelect.mockReturnValue(queryBuilder);
    queryBuilder.addSelect.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.skip.mockReturnValue(queryBuilder);
    queryBuilder.take.mockReturnValue(queryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(Task),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder,
            remove: jest.fn(),
          } as unknown as Partial<Repository<Task>>,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: {
            findOne: jest.fn(),
          } as Partial<Repository<Project>>,
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          } as Partial<Repository<User>>,
        },
        {
          provide: getRepositoryToken(Tag),
          useValue: {
            findBy: jest.fn(),
          } as Partial<Repository<Tag>>,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('finds a task by id with its comment count', async () => {
    const task = {
      id: 1,
      title: 'Test task',
    } as Task;

    getRawAndEntities.mockResolvedValue({
      entities: [task],
      raw: [{ task_commentCount: '3' }],
    });

    const result = await service.findById(1);

    expect(createQueryBuilder).toHaveBeenCalledWith('task');

    expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
      1,
      'task.project',
      'project',
    );

    expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
      2,
      'task.assignee',
      'assignee',
    );

    expect(queryBuilder.leftJoinAndSelect).toHaveBeenNthCalledWith(
      3,
      'task.tags',
      'tags',
    );

    expect(queryBuilder.addSelect).toHaveBeenCalledWith(
      expect.any(Function),
      'task_commentCount',
    );

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'task.id = :id',
      { id: 1 },
    );

    expect(getRawAndEntities).toHaveBeenCalled();

    expect(result).toBe(task);
    expect(result.commentCount).toBe(3);
  });

  it('throws when the task does not exist', async () => {
    getRawAndEntities.mockResolvedValue({
      entities: [],
      raw: [],
    });

    await expect(service.findById(999)).rejects.toThrow(
      'Task with id 999 not found',
    );

    expect(getRawAndEntities).toHaveBeenCalled();
  });
});
