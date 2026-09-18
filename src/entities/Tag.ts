import {
  Column,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn
} from 'typeorm';

import { Task } from './Task';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'varchar',
    unique: true,
    nullable: false
  })
  name!: string;

  @ManyToMany(() => Task, task => task.tags)
  tasks!: Task[];
}
