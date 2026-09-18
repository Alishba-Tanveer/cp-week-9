import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddTaskCreator1789481000000
  implements MigrationInterface
{
  name = 'AddTaskCreator1789481000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tasks',
      new TableColumn({
        name: 'creator_id',
        type: 'integer',
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'tasks',
      new TableIndex({
        name: 'idx_tasks_creator_id',
        columnNames: ['creator_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'tasks',
      new TableForeignKey({
        name: 'fk_tasks_creator_id',
        columnNames: ['creator_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'tasks',
      'fk_tasks_creator_id',
    );

    await queryRunner.dropIndex(
      'tasks',
      'idx_tasks_creator_id',
    );

    await queryRunner.dropColumn('tasks', 'creator_id');
  }
}
