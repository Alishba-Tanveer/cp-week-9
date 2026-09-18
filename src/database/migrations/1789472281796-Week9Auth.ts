import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class Week9Auth1789472281796 implements MigrationInterface {
  name = 'Week9Auth1789472281796';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD "password_hash" character varying
    `);

    await queryRunner.createTable(
      new Table({
        name: 'refresh_tokens',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'token_hash',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'revoked_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'refresh_tokens',
      new TableForeignKey({
        name: 'FK_refresh_tokens_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'refresh_tokens',
      'FK_refresh_tokens_user',
    );

    await queryRunner.dropTable('refresh_tokens');

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "password_hash"
    `);
  }
}