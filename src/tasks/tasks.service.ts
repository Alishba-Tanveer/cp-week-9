import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Comment } from '../entities/Comment';
import { Project } from '../entities/Project';
import { Tag } from '../entities/Tag';
import { Task } from '../entities/Task';
import { User } from '../entities/User';
import { CreateTaskDto } from './dto/create-task.dto';
import { TasksQueryDto } from './dto/tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,

    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
  ) {}

  async create(createTaskDto: CreateTaskDto, creatorId: number): Promise<Task> {
    const project = await this.projectsRepository.findOne({
      where: { id: createTaskDto.projectId },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${createTaskDto.projectId} not found`,
      );
    }

    let assignee: User | null = null;

    if (createTaskDto.assigneeId !== undefined) {
      assignee = await this.usersRepository.findOne({
        where: { id: createTaskDto.assigneeId },
      });

      if (!assignee) {
        throw new NotFoundException(
          `User with id ${createTaskDto.assigneeId} not found`,
        );
      }
    }

    let tags: Tag[] = [];

    if (createTaskDto.tagIds !== undefined) {
      tags = await this.tagsRepository.findBy({
        id: In(createTaskDto.tagIds),
      });

      if (tags.length !== createTaskDto.tagIds.length) {
        const foundTagIds = new Set(tags.map((tag) => tag.id));
        const missingTagId = createTaskDto.tagIds.find(
          (tagId) => !foundTagIds.has(tagId),
        );

        throw new NotFoundException(
          `Tag with id ${missingTagId} not found`,
        );
      }
    }

    const task = this.tasksRepository.create({
      title: createTaskDto.title,
      description: createTaskDto.description ?? null,
      status: createTaskDto.status,
      priority: createTaskDto.priority,
      project,
      projectId: project.id,
      creatorId,
      assignee,
      assigneeId: assignee?.id ?? null,
      tags,
    });

    return this.tasksRepository.save(task);
  }

  async findAll(
    filters: TasksQueryDto,
  ): Promise<{
    items: Task[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 10, 100);

    const query = this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.tags', 'tags');

    if (filters.status !== undefined) {
      query.andWhere('task.status = :status', {
        status: filters.status,
      });
    }

    if (filters.projectId !== undefined) {
      query.andWhere('task.projectId = :projectId', {
        projectId: filters.projectId,
      });
    }

    if (filters.assigneeId !== undefined) {
      query.andWhere('task.assigneeId = :assigneeId', {
        assigneeId: filters.assigneeId,
      });
    }

    query.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async findById(id: number): Promise<Task> {
    const query = this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.tags', 'tags')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(comment.id)')
          .from(Comment, 'comment')
          .where('comment.task_id = task.id');
      }, 'task_commentCount')
      .where('task.id = :id', { id });

    const { entities, raw } = await query.getRawAndEntities();

    const task = entities[0];

    if (!task) {
      throw new NotFoundException(`Task with id ${id} not found`);
    }

    task.commentCount = Number(raw[0]?.task_commentCount ?? 0);

    return task;
  }

  async update(id: number, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.findById(id);

    if (updateTaskDto.assigneeId !== undefined) {
      const assignee = await this.usersRepository.findOne({
        where: { id: updateTaskDto.assigneeId },
      });

      if (!assignee) {
        throw new NotFoundException(
          `User with id ${updateTaskDto.assigneeId} not found`,
        );
      }

      task.assignee = assignee;
      task.assigneeId = assignee.id;
    }

    if (updateTaskDto.tagIds !== undefined) {
      const tags = await this.tagsRepository.findBy({
        id: In(updateTaskDto.tagIds),
      });

      if (tags.length !== updateTaskDto.tagIds.length) {
        const foundTagIds = new Set(tags.map((tag) => tag.id));
        const missingTagId = updateTaskDto.tagIds.find(
          (tagId) => !foundTagIds.has(tagId),
        );

        throw new NotFoundException(
          `Tag with id ${missingTagId} not found`,
        );
      }

      task.tags = tags;
    }

    if (updateTaskDto.title !== undefined) {
      task.title = updateTaskDto.title;
    }

    if (updateTaskDto.description !== undefined) {
      task.description = updateTaskDto.description;
    }

    if (updateTaskDto.status !== undefined) {
      task.status = updateTaskDto.status;
    }

    if (updateTaskDto.priority !== undefined) {
      task.priority = updateTaskDto.priority;
    }

    return this.tasksRepository.save(task);
  }

  async remove(id: number): Promise<void> {
    const task = await this.tasksRepository.findOne({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException(`Task with id ${id} not found`);
    }

    await this.tasksRepository.remove(task);
  }
}