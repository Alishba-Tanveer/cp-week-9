import { randomUUID } from 'crypto';
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Week9AuthRefreshFamily1789480000000
  implements MigrationInterface
{
  name = 'Week9AuthRefreshFamily1789480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'refresh_tokens',
      new TableColumn({
        name: 'family_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    const rows = await queryRunner.query(
      'SELECT id FROM "refresh_tokens"',
    );

    for (const row of rows as Array<{ id: number }>) {
      await queryRunner.query(
        'UPDATE "refresh_tokens" SET "family_id" = $1 WHERE "id" = $2',
        [randomUUID(), row.id],
      );
    }

    await queryRunner.changeColumn(
      'refresh_tokens',
      'family_id',
      new TableColumn({
        name: 'family_id',
        type: 'uuid',
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('refresh_tokens', 'family_id');
  }
}
