import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountIcon1786924800000 implements MigrationInterface {
  name = 'AccountIcon1786924800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" ADD COLUMN "icon" varchar(32)`);
    await queryRunner.query(`
      ALTER TABLE "accounts"
        ADD CONSTRAINT "ck_accounts_icon"
        CHECK ("icon" IS NULL OR "icon" ~ '^[a-z0-9][a-z0-9-]{0,31}$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "ck_accounts_icon"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "icon"`);
  }
}
