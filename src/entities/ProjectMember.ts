import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import type { Relation } from 'typeorm';

import { Project } from './Project';
import { User } from './User';

export enum ProjectMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

@Entity('project_members')
export class ProjectMember {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId!: number;

  @PrimaryColumn({ name: 'project_id', type: 'integer' })
  projectId!: number;

  @ManyToOne(() => User, user => user.projectMemberships, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Project, project => project.members, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project!: Relation<Project>;

  @Column({
    type: 'enum',
    enum: ProjectMemberRole,
    nullable: false,
  })
  role!: ProjectMemberRole;
}