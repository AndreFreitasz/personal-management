import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecurrenceAutoDebit1787270400000 implements MigrationInterface {
  name = 'RecurrenceAutoDebit1787270400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "recurrences"
        ADD COLUMN "auto_debit" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "recurrences"
        ADD CONSTRAINT "ck_recurrences_auto_debit_only_debit"
        CHECK ("auto_debit" = false OR "type" = 'debit')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "recurrences" DROP CONSTRAINT "ck_recurrences_auto_debit_only_debit"
    `);
    await queryRunner.query(`ALTER TABLE "recurrences" DROP COLUMN "auto_debit"`);
  }
}
