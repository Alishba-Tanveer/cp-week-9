import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { Relation } from 'typeorm';

import { Comment } from './Comment';
import { Project } from './Project';
import { Tag } from './Tag';
import { User } from './User';

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

@Index('idx_tasks_project_id', ['projectId'])
@Index('idx_tasks_assignee_id', ['assigneeId'])
@Index('idx_tasks_creator_id', ['creatorId'])
@Index('idx_tasks_status', ['status'])
@Index('idx_tasks_project_status', ['projectId', 'status'])
@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', nullable: false })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    nullable: false,
  })
  status!: TaskStatus;

  @Column({ type: 'integer', nullable: false })
  priority!: number;

  @ManyToOne(() => Project, project => project.tasks, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project!: Relation<Project>;

  @Column({ name: 'project_id', type: 'integer' })
  projectId!: number;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_id' })
  creator!: Relation<User | null>;

  @Column({ name: 'creator_id', type: 'integer', nullable: true })
  creatorId!: number | null;

  @ManyToOne(() => User, user => user.assignedTasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'assignee_id' })
  assignee!: Relation<User | null>;

  @Column({ name: 'assignee_id', type: 'integer', nullable: true })
  assigneeId!: number | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @ManyToMany(() => Tag, tag => tag.tasks)
  @JoinTable({
    name: 'task_tags',
    joinColumn: {
      name: 'task_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'tag_id',
      referencedColumnName: 'id',
    },
  })
  tags!: Relation<Tag[]>;

  @OneToMany(() => Comment, comment => comment.task)
  comments!: Relation<Comment[]>;

  commentCount?: number;
}
