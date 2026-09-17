import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Comment } from '../entities/Comment';
import { Task } from '../entities/Task';
import { User } from '../entities/User';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentsQueryDto } from './dto/comments-query.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,

    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    taskId: number,
    createCommentDto: CreateCommentDto,
  ): Promise<Comment> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const author = await this.userRepository.findOne({
      where: { id: createCommentDto.authorId },
    });

    if (!author) {
      throw new NotFoundException('Author not found');
    }

    const comment = this.commentRepository.create({
      body: createCommentDto.body,
      task,
      author,
    });

    return this.commentRepository.save(comment);
  }

  async findByTask(
    taskId: number,
    filters: CommentsQueryDto,
  ): Promise<{
    items: Comment[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 10, 100);

    const query = this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.taskId = :taskId', { taskId })
      .orderBy('comment.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
    };
  }
}
