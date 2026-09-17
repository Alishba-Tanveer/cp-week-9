import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { Relation } from 'typeorm';

import { ProjectMember } from './ProjectMember';
import { Task } from './Task';
import { User } from './User';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', nullable: false })
  name!: string;

  @ManyToOne(() => User, user => user.ownedProjects, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'owner_id' })
  owner!: Relation<User>;

  @Column({ name: 'owner_id', type: 'integer' })
  ownerId!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @OneToMany(() => ProjectMember, projectMember => projectMember.project)
  members!: Relation<ProjectMember[]>;

  @OneToMany(() => Task, task => task.project)
  tasks!: Relation<Task[]>;
}