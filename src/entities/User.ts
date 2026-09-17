import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { Relation } from 'typeorm';

import { Comment } from './Comment';
import { Project } from './Project';
import { ProjectMember } from './ProjectMember';
import { Task } from './Task';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', nullable: false })
  name!: string;

  @Column({ type: 'varchar', unique: true, nullable: false })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @OneToMany(() => Project, project => project.owner)
  ownedProjects?: Relation<Project[]>;

  @OneToMany(() => ProjectMember, projectMember => projectMember.user)
  projectMemberships?: Relation<ProjectMember[]>;

  @OneToMany(() => Task, task => task.assignee)
  assignedTasks?: Relation<Task[]>;

  @OneToMany(() => Comment, comment => comment.author)
  comments?: Relation<Comment[]>;
}
