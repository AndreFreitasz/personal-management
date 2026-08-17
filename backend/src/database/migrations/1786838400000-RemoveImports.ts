import { MigrationInterface, QueryRunner } from 'typeorm';

import { F2Imports1786752000000 } from './1786752000000-F2Imports';

export class RemoveImports1786838400000 implements MigrationInterface {
  name = 'RemoveImports1786838400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "import_items"`);

    await queryRunner.query(`DROP INDEX "ix_transactions_user_fingerprint"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "fingerprint"`);
    await queryRunner.query(`DROP INDEX "ix_transactions_import"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "import_id"`);

    await queryRunner.query(`DROP TABLE "imports"`);
    await queryRunner.query(`DROP TABLE "import_profiles"`);

    await queryRunner.query(`DROP FUNCTION "fin_fingerprint"(uuid, timestamptz, numeric, text)`);
    await queryRunner.query(`DROP FUNCTION "fin_normalize_text"(text)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await new F2Imports1786752000000().up(queryRunner);
  }
}
