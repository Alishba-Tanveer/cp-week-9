import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { jest } from '@jest/globals';
import { Repository } from 'typeorm';

import { Comment } from '../entities/Comment';
import { Task } from '../entities/Task';
import { User } from '../entities/User';
import { CommentsQueryDto } from './dto/comments-query.dto';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let commentRepository: jest.Mocked<Repository<Comment>>;
  let taskRepository: jest.Mocked<Repository<Task>>;
  let userRepository: jest.Mocked<Repository<User>>;

  const getManyAndCount = jest.fn<
    () => Promise<[Comment[], number]>
  >();

  const queryBuilder = {
    leftJoinAndSelect: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: getRepositoryToken(Comment),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => queryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Task),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    commentRepository = module.get(getRepositoryToken(Comment));
    taskRepository = module.get(getRepositoryToken(Task));
    userRepository = module.get(getRepositoryToken(User));

    queryBuilder.leftJoinAndSelect.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.orderBy.mockReturnValue(queryBuilder);
    queryBuilder.skip.mockReturnValue(queryBuilder);
    queryBuilder.take.mockReturnValue(queryBuilder);

    jest.clearAllMocks();

    queryBuilder.leftJoinAndSelect.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.orderBy.mockReturnValue(queryBuilder);
    queryBuilder.skip.mockReturnValue(queryBuilder);
    queryBuilder.take.mockReturnValue(queryBuilder);
  });

  it('creates a comment when the task and author exist', async () => {
    const task = { id: 1 } as Task;
    const author = { id: 2 } as User;
    const comment = {
      id: 10,
      body: 'Test comment',
      task,
      author,
    } as Comment;

    taskRepository.findOne.mockResolvedValue(task);
    userRepository.findOne.mockResolvedValue(author);
    commentRepository.create.mockReturnValue(comment);
    commentRepository.save.mockResolvedValue(comment);

    const result = await service.create(1, {
      body: 'Test comment',
      authorId: 2,
    });

    expect(result).toBe(comment);
    expect(commentRepository.create).toHaveBeenCalledWith({
      body: 'Test comment',
      task,
      author,
    });
    expect(commentRepository.save).toHaveBeenCalledWith(comment);
  });

  it('throws NotFoundException when the task does not exist', async () => {
    taskRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create(999, {
        body: 'Test comment',
        authorId: 2,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(userRepository.findOne).not.toHaveBeenCalled();
    expect(commentRepository.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the author does not exist', async () => {
    const task = { id: 1 } as Task;

    taskRepository.findOne.mockResolvedValue(task);
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create(1, {
        body: 'Test comment',
        authorId: 999,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(commentRepository.create).not.toHaveBeenCalled();
  });

  it('returns paginated comments for an existing task', async () => {
    const task = { id: 1 } as Task;

    const comments = [
      {
        id: 10,
        body: 'First comment',
      },
      {
        id: 11,
        body: 'Second comment',
      },
    ] as Comment[];

    taskRepository.findOne.mockResolvedValue(task);
    getManyAndCount.mockResolvedValue([comments, 5]);

    const filters: CommentsQueryDto = {
      page: 2,
      pageSize: 2,
    };

    const result = await service.findByTask(1, filters);

    expect(result).toEqual({
      items: comments,
      total: 5,
      page: 2,
      pageSize: 2,
    });

    expect(commentRepository.createQueryBuilder).toHaveBeenCalledWith(
      'comment',
    );

    expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
      'comment.author',
      'author',
    );

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'comment.taskId = :taskId',
      { taskId: 1 },
    );

    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'comment.id',
      'ASC',
    );

    expect(queryBuilder.skip).toHaveBeenCalledWith(2);
    expect(queryBuilder.take).toHaveBeenCalledWith(2);
    expect(queryBuilder.getManyAndCount).toHaveBeenCalled();

    expect(result.items).toEqual(comments);
  });

  it('continues to page 2 after page 1', async () => {
    const task = { id: 1 } as Task;

    const pageOne = [
      { id: 1, body: 'Comment 1' },
      { id: 2, body: 'Comment 2' },
    ] as Comment[];

    const pageTwo = [
      { id: 3, body: 'Comment 3' },
      { id: 4, body: 'Comment 4' },
    ] as Comment[];

    taskRepository.findOne.mockResolvedValue(task);

    getManyAndCount.mockResolvedValueOnce([pageOne, 4]);

    const firstPage = await service.findByTask(1, {
      page: 1,
      pageSize: 2,
    });

    expect(firstPage).toEqual({
      items: pageOne,
      total: 4,
      page: 1,
      pageSize: 2,
    });

    getManyAndCount.mockResolvedValueOnce([pageTwo, 4]);

    const secondPage = await service.findByTask(1, {
      page: 2,
      pageSize: 2,
    });

    expect(secondPage).toEqual({
      items: pageTwo,
      total: 4,
      page: 2,
      pageSize: 2,
    });

    expect(queryBuilder.skip).toHaveBeenNthCalledWith(1, 0);
    expect(queryBuilder.take).toHaveBeenNthCalledWith(1, 2);

    expect(queryBuilder.skip).toHaveBeenNthCalledWith(2, 2);
    expect(queryBuilder.take).toHaveBeenNthCalledWith(2, 2);
  });

  it('throws NotFoundException when finding comments for a missing task', async () => {
    taskRepository.findOne.mockResolvedValue(null);

    await expect(
      service.findByTask(999, {
        page: 1,
        pageSize: 10,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(commentRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
